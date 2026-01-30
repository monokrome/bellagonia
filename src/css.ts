import { existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const CSS_EXTENSIONS = [
  ".css.ts",
  ".css.js",
  ".module.css",
  ".module.scss",
  ".css",
];

export interface SiblingCss {
  path: string;
  importPath: string;
}

export function findSiblingCss(filePath: string): SiblingCss | null {
  const dir = dirname(filePath);
  const base = basename(filePath).replace(/\.(ts|js|tsx|jsx)$/, "");

  for (const ext of CSS_EXTENSIONS) {
    const cssPath = join(dir, base + ext);

    if (existsSync(cssPath)) {
      let importPath = "./" + base + ext;

      if (ext === ".css.ts" || ext === ".css.js") {
        importPath = "./" + base + ".css";
      }

      return { path: cssPath, importPath };
    }
  }

  return null;
}
