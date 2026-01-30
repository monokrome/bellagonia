import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { findSiblingCss } from "../src/css.js";

const mockExists = vi.mocked(existsSync);

beforeEach(() => {
  mockExists.mockReset();
});

describe("findSiblingCss", () => {
  it("finds .css.ts sibling (vanilla-extract)", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "counter.css.ts"),
    );

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toEqual({
      path: join("/app/src/directives", "counter.css.ts"),
      importPath: "./counter.css",
    });
  });

  it("finds .css.js sibling (vanilla-extract compiled)", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "counter.css.js"),
    );

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toEqual({
      path: join("/app/src/directives", "counter.css.js"),
      importPath: "./counter.css",
    });
  });

  it("finds .module.css sibling", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "counter.module.css"),
    );

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toEqual({
      path: join("/app/src/directives", "counter.module.css"),
      importPath: "./counter.module.css",
    });
  });

  it("finds .module.scss sibling", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "counter.module.scss"),
    );

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toEqual({
      path: join("/app/src/directives", "counter.module.scss"),
      importPath: "./counter.module.scss",
    });
  });

  it("finds plain .css sibling", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "counter.css"),
    );

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toEqual({
      path: join("/app/src/directives", "counter.css"),
      importPath: "./counter.css",
    });
  });

  it("respects priority order (.css.ts wins over .module.css)", () => {
    mockExists.mockImplementation((p) => {
      const s = String(p);
      return (
        s === join("/app/src/directives", "counter.css.ts") ||
        s === join("/app/src/directives", "counter.module.css")
      );
    });

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result?.importPath).toBe("./counter.css");
    expect(result?.path).toBe(join("/app/src/directives", "counter.css.ts"));
  });

  it("returns null when no sibling exists", () => {
    mockExists.mockReturnValue(false);

    const result = findSiblingCss("/app/src/directives/counter.ts");
    expect(result).toBeNull();
  });

  it("strips .ts extension from vanilla-extract import paths", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "theme.css.ts"),
    );

    const result = findSiblingCss("/app/src/directives/theme.ts");
    expect(result?.importPath).toBe("./theme.css");
  });

  it("handles .tsx source files", () => {
    mockExists.mockImplementation(
      (p) => String(p) === join("/app/src/directives", "widget.module.css"),
    );

    const result = findSiblingCss("/app/src/directives/widget.tsx");
    expect(result).toEqual({
      path: join("/app/src/directives", "widget.module.css"),
      importPath: "./widget.module.css",
    });
  });
});
