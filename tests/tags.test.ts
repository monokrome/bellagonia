import { describe, it, expect } from "vitest";
import { createStyleTags } from "../src/tags.js";

describe("createStyleTags", () => {
  it("returns empty string for empty array", () => {
    expect(createStyleTags([])).toBe("");
  });

  describe("import mode (default)", () => {
    it("generates a style block with @import", () => {
      const result = createStyleTags(
        ["/app/src/directives/counter.module.css"],
        { base: "/app" },
      );

      expect(result).toBe(
        '<style>\n@import url("/src/directives/counter.module.css");\n</style>',
      );
    });

    it("generates multiple @import rules", () => {
      const result = createStyleTags(
        [
          "/app/src/directives/counter.module.css",
          "/app/src/directives/widget.module.css",
        ],
        { base: "/app" },
      );

      expect(result).toBe(
        [
          "<style>",
          '@import url("/src/directives/counter.module.css");',
          '@import url("/src/directives/widget.module.css");',
          "</style>",
        ].join("\n"),
      );
    });

    it("uses absolute paths when no base is provided", () => {
      const result = createStyleTags([
        "/app/src/directives/counter.module.css",
      ]);

      expect(result).toBe(
        '<style>\n@import url("/app/src/directives/counter.module.css");\n</style>',
      );
    });

    it("uses custom prefix", () => {
      const result = createStyleTags(
        ["/app/src/directives/counter.module.css"],
        { base: "/app", prefix: "/assets/" },
      );

      expect(result).toBe(
        '<style>\n@import url("/assets/src/directives/counter.module.css");\n</style>',
      );
    });
  });

  describe("link mode", () => {
    it("generates a link tag with base", () => {
      const result = createStyleTags(
        ["/app/src/directives/counter.module.css"],
        { base: "/app", mode: "link" },
      );

      expect(result).toBe(
        '<link rel="stylesheet" href="/src/directives/counter.module.css">',
      );
    });

    it("generates multiple tags separated by newlines", () => {
      const result = createStyleTags(
        [
          "/app/src/directives/counter.module.css",
          "/app/src/directives/widget.module.css",
        ],
        { base: "/app", mode: "link" },
      );

      expect(result).toBe(
        [
          '<link rel="stylesheet" href="/src/directives/counter.module.css">',
          '<link rel="stylesheet" href="/src/directives/widget.module.css">',
        ].join("\n"),
      );
    });

    it("uses absolute paths when no base is provided", () => {
      const result = createStyleTags(
        ["/app/src/directives/counter.module.css"],
        { mode: "link" },
      );

      expect(result).toBe(
        '<link rel="stylesheet" href="/app/src/directives/counter.module.css">',
      );
    });

    it("uses custom prefix", () => {
      const result = createStyleTags(
        ["/app/src/directives/counter.module.css"],
        { base: "/app", prefix: "/assets/", mode: "link" },
      );

      expect(result).toBe(
        '<link rel="stylesheet" href="/assets/src/directives/counter.module.css">',
      );
    });
  });
});
