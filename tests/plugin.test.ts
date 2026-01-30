import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plugin } from "vite";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { bellagonia } from "../src/plugin.js";
import { getCollectedStyles, clearCollectedStyles } from "../src/registry.js";

const mockExists = vi.mocked(existsSync);

function getTransform(plugin: Plugin) {
  if (typeof plugin.transform === "function") {
    return plugin.transform;
  }

  if (
    plugin.transform &&
    typeof plugin.transform === "object" &&
    "handler" in plugin.transform
  ) {
    return plugin.transform.handler;
  }

  throw new Error("Plugin has no transform hook");
}

function callTransform(plugin: Plugin, code: string, id: string) {
  const transform = getTransform(plugin);
  return transform.call({} as never, code, id);
}

beforeEach(() => {
  mockExists.mockReset();
  clearCollectedStyles();
});

describe("bellagonia plugin", () => {
  it("has the correct name", () => {
    const plugin = bellagonia();
    expect(plugin.name).toBe("bellagonia");
  });

  it("skips non-JS files", () => {
    const plugin = bellagonia();
    const result = callTransform(
      plugin,
      "directive('x', fn)",
      "/app/src/directives/x.html",
    );
    expect(result).toBeNull();
  });

  it("skips node_modules", () => {
    const plugin = bellagonia();
    const result = callTransform(
      plugin,
      "directive('x', fn)",
      "/app/node_modules/some-lib/x.ts",
    );
    expect(result).toBeNull();
  });

  it("skips files without directive() calls", () => {
    const plugin = bellagonia();
    const result = callTransform(
      plugin,
      "const x = 1",
      "/app/src/directives/x.ts",
    );
    expect(result).toBeNull();
  });

  it("skips files not matching directiveSources patterns", () => {
    const plugin = bellagonia({ directiveSources: ["src/directives/**/*.ts"] });
    const result = callTransform(
      plugin,
      "directive('x', fn)",
      "/app/src/components/x.ts",
    );
    expect(result).toBeNull();
  });

  it("skips when no sibling CSS found", () => {
    mockExists.mockReturnValue(false);
    const plugin = bellagonia();
    const result = callTransform(
      plugin,
      "directive('x', fn)",
      "/app/src/directives/x.ts",
    );
    expect(result).toBeNull();
  });

  it("transforms matching directive files", () => {
    mockExists.mockImplementation((p) => String(p).endsWith("x.module.css"));

    const plugin = bellagonia();
    const code = [
      "import { directive } from 'gonia'",
      "directive('x', fn)",
    ].join("\n");

    const result = callTransform(plugin, code, "/app/src/directives/x.ts");

    expect(result).not.toBeNull();
    expect((result as { code: string }).code).toContain(
      "import * as $styles from './x.module.css'",
    );
    expect((result as { code: string }).code).toContain("assign: { $styles }");
  });

  it("respects autoStyles: false", () => {
    const plugin = bellagonia({ autoStyles: false });
    const result = callTransform(
      plugin,
      "directive('x', fn)",
      "/app/src/directives/x.ts",
    );
    expect(result).toBeNull();
  });

  it("respects custom directiveSources patterns", () => {
    mockExists.mockImplementation((p) =>
      String(p).endsWith("widget.module.css"),
    );

    const plugin = bellagonia({ directiveSources: ["lib/components/**/*.ts"] });
    const code = [
      "import { directive } from 'gonia'",
      "directive('widget', fn)",
    ].join("\n");

    const result = callTransform(plugin, code, "/app/lib/components/widget.ts");

    expect(result).not.toBeNull();
    expect((result as { code: string }).code).toContain("$styles");
  });

  it("registers CSS path when transforming a directive", () => {
    mockExists.mockImplementation((p) => String(p).endsWith("x.module.css"));

    const plugin = bellagonia();
    const code = [
      "import { directive } from 'gonia'",
      "directive('x', fn)",
    ].join("\n");

    callTransform(plugin, code, "/app/src/directives/x.ts");

    const styles = getCollectedStyles();
    expect(styles).toHaveLength(1);
    expect(styles[0]).toContain("x.module.css");
  });

  it("does not collect when autoStyles is false", () => {
    mockExists.mockImplementation((p) => String(p).endsWith("x.module.css"));

    const plugin = bellagonia({ autoStyles: false });
    const code = [
      "import { directive } from 'gonia'",
      "directive('x', fn)",
    ].join("\n");

    callTransform(plugin, code, "/app/src/directives/x.ts");

    expect(getCollectedStyles()).toEqual([]);
  });
});
