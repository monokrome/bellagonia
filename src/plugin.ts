import type { Plugin } from "vite";
import { findSiblingCss } from "./css.js";
import { hasDirectiveCall, transformDirective } from "./transform.js";
import { registerStyle, clearCollectedStyles } from "./registry.js";

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

export function bellagonia(options: BellagoniaOptions = {}): Plugin {
  const { directiveSources = ["src/directives/**/*.ts"], autoStyles = true } =
    options;

  return {
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
}
