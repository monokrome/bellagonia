import { describe, it, expect, beforeEach } from "vitest";
import {
  registerStyle,
  getCollectedStyles,
  clearCollectedStyles,
} from "../src/registry.js";

beforeEach(() => {
  clearCollectedStyles();
});

describe("registry", () => {
  it("adds a style path", () => {
    registerStyle("/app/src/directives/counter.module.css");
    expect(getCollectedStyles()).toEqual([
      "/app/src/directives/counter.module.css",
    ]);
  });

  it("deduplicates identical paths", () => {
    registerStyle("/app/src/directives/counter.module.css");
    registerStyle("/app/src/directives/counter.module.css");
    expect(getCollectedStyles()).toEqual([
      "/app/src/directives/counter.module.css",
    ]);
  });

  it("collects multiple distinct paths", () => {
    registerStyle("/app/src/directives/counter.module.css");
    registerStyle("/app/src/directives/widget.module.css");
    expect(getCollectedStyles()).toEqual([
      "/app/src/directives/counter.module.css",
      "/app/src/directives/widget.module.css",
    ]);
  });

  it("clear removes all collected styles", () => {
    registerStyle("/app/src/directives/counter.module.css");
    clearCollectedStyles();
    expect(getCollectedStyles()).toEqual([]);
  });

  it("returns a snapshot, not the live set", () => {
    registerStyle("/app/src/directives/counter.module.css");
    const snapshot = getCollectedStyles();
    registerStyle("/app/src/directives/widget.module.css");
    expect(snapshot).toEqual(["/app/src/directives/counter.module.css"]);
  });
});
