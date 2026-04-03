import { createRequire } from "node:module";
import type { Plugin } from "vite";
import { findSiblingCss } from "./css.js";
import { hasDirectiveCall, transformDirective } from "./transform.js";
import { registerStyle, clearCollectedStyles } from "./registry.js";

const require = createRequire(import.meta.url);

export interface BellagoniaOptions {
  directiveSources?: string[];
  autoStyles?: boolean;
}

function globToRegex(pattern: string): RegExp {
  let regex = "";

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      regex += ".*";
      i++;

      if (pattern[i + 1] === "/") {
        i++;
      }
    } else if (pattern[i] === "*") {
      regex += "[^/]*";
    } else if (".+?^${}()|[]\\".includes(pattern[i])) {
      regex += "\\" + pattern[i];
    } else {
      regex += pattern[i];
    }
  }

  return new RegExp(regex + "$");
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return globToRegex(pattern).test(normalized);
}

function tryLoadVanillaExtract(): Plugin[] {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const ve = require("@vanilla-extract/vite-plugin") as Record<
      string,
      unknown
    >;
    const factory = ve.vanillaExtractPlugin as (
      opts: Record<string, unknown>,
    ) => unknown;
    const result = factory({ unstable_mode: "transform" });
    return Array.isArray(result) ? result : [result as Plugin];
  } catch (e: unknown) {
    if ((e as { code?: string }).code !== "MODULE_NOT_FOUND") throw e;
    return [];
  }
}

export function bellagonia(options: BellagoniaOptions = {}): Plugin | Plugin[] {
  const { directiveSources = ["src/directives/**/*.ts"], autoStyles = true } =
    options;

  const bellagoniaPlugin: Plugin = {
    name: "bellagonia",
    enforce: "pre",

    buildStart() {
      clearCollectedStyles();
    },

    transform(code, id) {
      if (!autoStyles) {
        return null;
      }

      if (!/\.(ts|js|tsx|jsx)$/.test(id)) {
        return null;
      }

      if (id.includes("node_modules")) {
        return null;
      }

      if (!hasDirectiveCall(code)) {
        return null;
      }

      const isDirectiveFile = directiveSources.some((pattern) =>
        matchesPattern(id, pattern),
      );

      if (!isDirectiveFile) {
        return null;
      }

      const css = findSiblingCss(id);

      if (!css) {
        return null;
      }

      registerStyle(css.path);

      const transformed = transformDirective(code, css.importPath);

      if (transformed !== code) {
        return { code: transformed, map: null };
      }

      return null;
    },
  };

  const vePlugins = tryLoadVanillaExtract();

  if (vePlugins.length > 0) {
    return [...vePlugins, bellagoniaPlugin];
  }

  return bellagoniaPlugin;
}
