import { describe, it, expect } from "vitest";
import {
  hasDirectiveCall,
  hasStylesImport,
  hasStylesAssign,
  transformDirective,
} from "../src/transform.js";

describe("hasDirectiveCall", () => {
  it("detects directive( call", () => {
    expect(hasDirectiveCall("directive('counter', fn)")).toBe(true);
  });

  it("detects directive with whitespace before paren", () => {
    expect(hasDirectiveCall("directive ('counter', fn)")).toBe(true);
  });

  it("returns false for unrelated code", () => {
    expect(hasDirectiveCall("const x = 1")).toBe(false);
  });
});

describe("hasStylesImport", () => {
  it("detects existing import", () => {
    const code = `import * as $styles from './counter.css'`;
    expect(hasStylesImport(code, "./counter.css")).toBe(true);
  });

  it("detects import with double quotes", () => {
    const code = `import * as $styles from "./counter.css"`;
    expect(hasStylesImport(code, "./counter.css")).toBe(true);
  });

  it("returns false when import is absent", () => {
    const code = `import { directive } from 'gonia'`;
    expect(hasStylesImport(code, "./counter.css")).toBe(false);
  });

  it("escapes special regex characters in path", () => {
    const code = `import styles from './file.module.css'`;
    expect(hasStylesImport(code, "./file.module.css")).toBe(true);
  });
});

describe("hasStylesAssign", () => {
  it("detects $styles in simple assign", () => {
    const code = `directive('x', fn, { assign: { $styles } })`;
    expect(hasStylesAssign(code)).toBe(true);
  });

  it("detects $styles in assign with other values", () => {
    const code = `directive('x', fn, { assign: { foo, $styles } })`;
    expect(hasStylesAssign(code)).toBe(true);
  });

  it("returns false when no assign", () => {
    const code = `directive('x', fn, { scope: true })`;
    expect(hasStylesAssign(code)).toBe(false);
  });

  it("handles nested braces in assign (the bug fix)", () => {
    const code = `directive('x', fn, { assign: { nested: { deep: true }, $styles } })`;
    expect(hasStylesAssign(code)).toBe(true);
  });

  it("does not false-positive when $styles is outside assign", () => {
    const code = `const $styles = {}; directive('x', fn, { assign: { foo } })`;
    expect(hasStylesAssign(code)).toBe(false);
  });

  it("handles deeply nested objects without false negatives", () => {
    const code = `directive('x', fn, { assign: { a: { b: { c: {} } }, $styles } })`;
    expect(hasStylesAssign(code)).toBe(true);
  });
});

describe("transformDirective", () => {
  it("adds import after last existing import", () => {
    const code = [
      "import { directive } from 'gonia'",
      "import { something } from './other'",
      "",
      "directive('counter', fn)",
    ].join("\n");

    const result = transformDirective(code, "./counter.module.css");
    const lines = result.split("\n");
    expect(lines[0]).toBe("import { directive } from 'gonia'");
    expect(lines[1]).toBe("import { something } from './other'");
    expect(lines[2]).toBe("import * as $styles from './counter.module.css'");
  });

  it("adds import at top when no imports exist", () => {
    const code = "directive('counter', fn)";
    const result = transformDirective(code, "./counter.css");
    expect(
      result.startsWith("import * as $styles from './counter.css'\n"),
    ).toBe(true);
  });

  it("skips import when already present", () => {
    const code = [
      "import * as $styles from './counter.css'",
      "directive('counter', fn)",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    const importCount = (result.match(/import \* as \$styles/g) || []).length;
    expect(importCount).toBe(1);
  });

  it("adds assign with options to directive with existing options", () => {
    const code = [
      "import { directive } from 'gonia'",
      "directive('counter', fn, { scope: true })",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    expect(result).toContain("assign: { $styles }");
    expect(result).toContain("scope: true");
  });

  it("adds $styles to existing assign object", () => {
    const code = [
      "import { directive } from 'gonia'",
      "directive('counter', fn, { assign: { foo } })",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    expect(result).toContain("foo, $styles");
  });

  it("adds options object to directive without one", () => {
    const code = [
      "import { directive } from 'gonia'",
      "directive('counter', fn)",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    expect(result).toContain("{ assign: { $styles } }");
  });

  it("handles nested braces in existing assign (the bug fix)", () => {
    const code = [
      "import { directive } from 'gonia'",
      "directive('counter', fn, { assign: { nested: { deep: true } } })",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    expect(result).toContain("$styles");
    expect(result).toContain("nested: { deep: true }");
  });

  it("skips transformation when $styles already present", () => {
    const code = [
      "import * as $styles from './counter.css'",
      "directive('counter', fn, { assign: { $styles } })",
    ].join("\n");

    const result = transformDirective(code, "./counter.css");
    expect(result).toBe(code);
  });

  it("handles multiple directive calls in one file", () => {
    const code = [
      "import { directive } from 'gonia'",
      "directive('a', fnA)",
      "directive('b', fnB)",
    ].join("\n");

    const result = transformDirective(code, "./styles.css");
    const assignCount = (result.match(/assign: \{ \$styles \}/g) || []).length;
    expect(assignCount).toBe(2);
  });
});
