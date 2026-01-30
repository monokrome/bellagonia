# bellagonia

Vite plugin that automatically injects scoped styles into [Gonia](https://github.com/monokrome/gonia) directives.

## Install

```sh
pnpm add -D bellagonia
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { bellagonia } from "bellagonia";

export default defineConfig({
  plugins: [bellagonia()],
});
```

When a directive file has a sibling CSS file, bellagonia automatically adds a style import and passes it via `assign`:

```ts
// src/directives/counter.ts (before)
import { directive } from "gonia";
directive("counter", setup);

// src/directives/counter.ts (after transform)
import { directive } from "gonia";
import * as $styles from "./counter.module.css";
directive("counter", setup, { assign: { $styles } });
```

## Options

```ts
bellagonia({
  // Glob patterns for directive source files
  // Default: ['src/directives/**/*.ts']
  directiveSources: ["src/directives/**/*.ts"],

  // Enable automatic style injection
  // Default: true
  autoStyles: true,
});
```

## SSR API

For SSR frameworks that construct their own HTML, bellagonia exposes a programmatic API to retrieve collected style paths and generate markup.

```ts
import { getCollectedStyles, createStyleTags } from "bellagonia";

// Get all CSS paths discovered during transform
const styles = getCollectedStyles();
// ['/app/src/directives/counter.module.css', '/app/src/directives/widget.module.css']

// Generate a <style> block with @import rules (default)
createStyleTags(styles, { base: "/app" });
// <style>
// @import url("/src/directives/counter.module.css");
// @import url("/src/directives/widget.module.css");
// </style>

// Generate <link> tags instead
createStyleTags(styles, { base: "/app", mode: "link" });
// <link rel="stylesheet" href="/src/directives/counter.module.css">
// <link rel="stylesheet" href="/src/directives/widget.module.css">
```

### `createStyleTags(paths, options?)`

| Option   | Type                 | Default    | Description                          |
| -------- | -------------------- | ---------- | ------------------------------------ |
| `mode`   | `'import' \| 'link'` | `'import'` | Output format                        |
| `base`   | `string`             |            | Project root for relative path resolution |
| `prefix` | `string`             | `'/'`      | URL prefix prepended to paths        |

## CSS Detection

Bellagonia looks for sibling CSS files next to each directive source file, checking these extensions in priority order:

1. `.css.ts` (vanilla-extract)
2. `.css.js` (vanilla-extract compiled)
3. `.module.css`
4. `.module.scss`
5. `.css`

The first match wins. For example, given `src/directives/counter.ts`, it checks for `counter.css.ts`, then `counter.css.js`, and so on.

## License

BSD-2-Clause
