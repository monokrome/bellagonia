import { relative } from "node:path";

export interface CreateStyleTagsOptions {
  base?: string;
  prefix?: string;
  mode?: "import" | "link";
}

function toHref(absolutePath: string, base?: string, prefix = "/"): string {
  if (base) {
    return prefix + relative(base, absolutePath);
  }

  return absolutePath;
}

export function createStyleTags(
  stylePaths: string[],
  options: CreateStyleTagsOptions = {},
): string {
  const { base, prefix = "/", mode = "import" } = options;

  if (stylePaths.length === 0) {
    return "";
  }

  if (mode === "link") {
    return stylePaths
      .map((p) => `<link rel="stylesheet" href="${toHref(p, base, prefix)}">`)
      .join("\n");
  }

  const imports = stylePaths
    .map((p) => `@import url("${toHref(p, base, prefix)}");`)
    .join("\n");

  return `<style>\n${imports}\n</style>`;
}
