# bellagonia

Vite plugin that automatically injects scoped styles into [Gonia](https://github.com/monokrome/gonia) directives.

Gonia's `directive()` function accepts an `assign` option that passes values into the directive's scope. Bellagonia hooks into Vite's transform pipeline to wire that up for you: when a directive file has a sibling CSS file, bellagonia adds the import and passes the styles object via `assign` at build time. No manual boilerplate, no runtime cost.

## Install

```sh
pnpm add -D bellagonia
```

```sh
npm install -D bellagonia
```

```sh
yarn add -D bellagonia
```

Requires `vite >= 5.0.0` and `gonia >= 0.3.0` as peer dependencies.

## Quick Start

Add bellagonia to your Vite config:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { bellagonia } from "bellagonia";

export default defineConfig({
  plugins: [bellagonia()],
});
```

Create a directive with a sibling CSS module:

```
src/directives/
  counter.ts
  counter.module.css
```

```ts
// src/directives/counter.ts
import { directive } from "gonia";

directive("counter", (el) => {
  // ...
});
```

After bellagonia's transform, the file is equivalent to:

```ts
import { directive } from "gonia";
import * as $styles from "./counter.module.css";

directive("counter", (el) => {
  // ...
}, { assign: { $styles } });
```

The `$styles` object is now available in the directive's scope with all the class names from `counter.module.css`.

## How It Works

Bellagonia runs as a Vite `pre`-enforce plugin. On every module transform, it applies the following decision tree:

1. **Skip if disabled** - `autoStyles` is `false` &rarr; no-op
2. **Skip non-script files** - file extension is not `.ts`, `.js`, `.tsx`, or `.jsx` &rarr; no-op
3. **Skip dependencies** - path contains `node_modules` &rarr; no-op
4. **Fast bail-out** - source code does not contain a `directive(` call &rarr; no-op (avoids filesystem access)
5. **Glob check** - file path does not match any `directiveSources` pattern &rarr; no-op
6. **CSS lookup** - no sibling CSS file found &rarr; no-op
7. **Transform** - inject the `$styles` import and add `{ assign: { $styles } }` to every `directive()` call in the file

The transform is **idempotent**. Running it on already-transformed code produces the same output. Both the import and the `$styles` assignment are checked before injection, so you can safely have bellagonia enabled alongside manually wired styles.

When a file contains **multiple `directive()` calls**, each one is independently checked and injected. They are processed in reverse source order so that string index offsets remain stable during mutation.

## Configuration

```ts
bellagonia(options?: BellagoniaOptions)
```

| Option             | Type       | Default                        | Description                                              |
| ------------------ | ---------- | ------------------------------ | -------------------------------------------------------- |
| `directiveSources` | `string[]` | `['src/directives/**/*.ts']`   | Glob patterns that identify directive source files        |
| `autoStyles`       | `boolean`  | `true`                         | Enable or disable automatic style injection               |

### Custom directive locations

If your directives live outside `src/directives/`, pass custom glob patterns:

```ts
bellagonia({
  directiveSources: [
    "src/directives/**/*.ts",
    "src/components/**/*.directive.ts",
    "lib/widgets/**/*.ts",
  ],
});
```

Glob patterns support `**` (any depth, including slashes) and `*` (any characters except `/`). Paths are normalized to forward slashes before matching, so patterns work on Windows.

### Disabling the transform

Set `autoStyles: false` to disable automatic injection entirely. This is useful if you only want the SSR collection API and prefer to wire styles manually.

```ts
bellagonia({ autoStyles: false });
```

## CSS Detection

Bellagonia looks for a sibling CSS file next to each directive source file. Given a directive at `src/directives/counter.ts`, it strips the `.ts` extension and checks for these files in priority order:

| Priority | Extension      | Import path generated    | Use case                    |
| -------- | -------------- | ------------------------ | --------------------------- |
| 1        | `.css.ts`      | `./counter.css`          | vanilla-extract source      |
| 2        | `.css.js`      | `./counter.css`          | vanilla-extract compiled    |
| 3        | `.module.css`  | `./counter.module.css`   | CSS Modules                 |
| 4        | `.module.scss` | `./counter.module.scss`  | SCSS Modules                |
| 5        | `.css`         | `./counter.css`          | Plain CSS                   |

The first match wins. If no sibling CSS file exists, the directive is left untouched.

### vanilla-extract

For `.css.ts` and `.css.js` files, bellagonia generates an import path ending in `.css` (stripping the `.ts`/`.js` suffix). This matches vanilla-extract's convention where the compiled output is exposed at the `.css` path:

```
src/directives/
  theme.ts          # directive source
  theme.css.ts      # vanilla-extract styles
```

Produces:

```ts
import * as $styles from "./theme.css";
```

### Multiple style formats

Only one CSS file per directive is supported. If both `counter.css.ts` and `counter.module.css` exist, the higher-priority file wins (`.css.ts` in this case).

## SSR

For server-side rendering, bellagonia provides a programmatic API to collect and render the style paths discovered during the build. This is useful when your SSR framework constructs its own HTML shell and needs to know which stylesheets to include.

### Collecting styles

```ts
import { getCollectedStyles, clearCollectedStyles } from "bellagonia";

// Returns a snapshot array of all absolute CSS paths found during transform
const styles = getCollectedStyles();
// ['/app/src/directives/counter.module.css', '/app/src/directives/widget.module.css']
```

`getCollectedStyles` returns a new array each time (a snapshot of the internal set), so it is safe to call multiple times without worrying about mutation.

The style registry is a process-wide singleton. It is automatically cleared at the start of each Vite build via the plugin's `buildStart` hook. To manually reset it (for example, between SSR renders in a long-lived server):

```ts
clearCollectedStyles();
```

### Generating HTML markup

```ts
import { getCollectedStyles, createStyleTags } from "bellagonia";

const styles = getCollectedStyles();

// Default: a <style> block with @import rules
createStyleTags(styles, { base: "/app" });
```

```html
<style>
@import url("/src/directives/counter.module.css");
@import url("/src/directives/widget.module.css");
</style>
```

```ts
// Alternative: individual <link> tags
createStyleTags(styles, { base: "/app", mode: "link" });
```

```html
<link rel="stylesheet" href="/src/directives/counter.module.css">
<link rel="stylesheet" href="/src/directives/widget.module.css">
```

Returns an empty string when the paths array is empty.

### `createStyleTags` options

| Option   | Type                 | Default    | Description                                       |
| -------- | -------------------- | ---------- | ------------------------------------------------- |
| `base`   | `string`             | &mdash;    | Project root; paths are made relative to this      |
| `prefix` | `string`             | `'/'`      | URL prefix prepended to each resolved path         |
| `mode`   | `'import' \| 'link'` | `'import'` | Output format: `@import` rules or `<link>` tags   |

When `base` is omitted, absolute filesystem paths are used as-is. In most SSR setups you'll want to pass your project root so the output contains web-relative paths.

The `prefix` option controls the leading path segment. For example, setting `prefix: '/assets/'` produces paths like `/assets/src/directives/counter.module.css`.

### SSR example

A complete SSR integration might look like:

```ts
import { getCollectedStyles, createStyleTags, clearCollectedStyles } from "bellagonia";

function renderPage(url: string): string {
  clearCollectedStyles();

  const appHtml = renderApp(url);
  const styleTags = createStyleTags(getCollectedStyles(), {
    base: process.cwd(),
    mode: "link",
  });

  return `<!DOCTYPE html>
<html>
<head>
  ${styleTags}
</head>
<body>
  ${appHtml}
</body>
</html>`;
}
```

## API Reference

### `bellagonia(options?)`

Creates the Vite plugin.

```ts
import { bellagonia } from "bellagonia";

function bellagonia(options?: BellagoniaOptions): Plugin;
```

```ts
interface BellagoniaOptions {
  directiveSources?: string[];  // Default: ['src/directives/**/*.ts']
  autoStyles?: boolean;         // Default: true
}
```

Returns a Vite `Plugin` with `enforce: "pre"` that implements `buildStart` and `transform` hooks.

---

### `getCollectedStyles()`

Returns a snapshot of all CSS paths discovered during the current build.

```ts
import { getCollectedStyles } from "bellagonia";

function getCollectedStyles(): string[];
```

Each entry is an absolute filesystem path. The array is a copy of the internal set, so mutating it has no effect on the registry.

---

### `clearCollectedStyles()`

Resets the style registry.

```ts
import { clearCollectedStyles } from "bellagonia";

function clearCollectedStyles(): void;
```

Called automatically by the plugin at the start of each build. Exposed for manual use in SSR scenarios where you need to reset between renders.

---

### `createStyleTags(paths, options?)`

Converts an array of style paths into HTML markup.

```ts
import { createStyleTags } from "bellagonia";

function createStyleTags(
  stylePaths: string[],
  options?: CreateStyleTagsOptions,
): string;
```

```ts
interface CreateStyleTagsOptions {
  base?: string;
  prefix?: string;              // Default: '/'
  mode?: "import" | "link";     // Default: 'import'
}
```

Returns an empty string when `stylePaths` is empty.

In `'import'` mode, returns a single `<style>` element containing `@import url(...)` rules. In `'link'` mode, returns one `<link rel="stylesheet">` element per path, separated by newlines.

---

### Types

Both option interfaces are exported for use in typed configuration:

```ts
import type { BellagoniaOptions, CreateStyleTagsOptions } from "bellagonia";
```

## License

BSD-2-Clause
