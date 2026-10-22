# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Browser-only Mermaid editor: Monaco editor on the left, live Mermaid preview on the right (pan/zoom, PNG/SVG export, copy as image, dark mode). Plain JavaScript ES modules bundled by Vite. No backend, no framework, no TypeScript.

The code was vibecoded quickly and is not reviewed. Expect bugs and gaps. Verify behavior before you trust it.

## Commands

Package manager is pnpm (pinned in `package.json`).

- `pnpm install`
- `pnpm dev`: Vite dev server
- `pnpm build`: production build to `dist/`
- `pnpm preview`: serve the build

- `pnpm check`: runs `scripts/check-env-leak.js` (fails if a value from `.env.local` appears in a file git tracks or would add), `scripts/check-snippets.js`, which expands every autocomplete snippet and checks it with `mermaid.parse()` (in jsdom), and `scripts/check-diagrams.js`, which tests diagram loading (`diagrams.js`). Run it after changing snippets, diagram storage or upgrading Mermaid, and before committing.

There are no other tests, no linter and no formatter. To check a change, run the app in a browser.

## Architecture

- `index.html` holds the layout and all CSS. The theme uses CSS variables switched by `data-theme` on `<html>`.
- `main.js` does all wiring: Monaco setup, a debounced render (250 ms) through `mermaid.parse` and `mermaid.render`, mapping Mermaid errors to Monaco markers, export, the theme toggle, the resizable split and pan/zoom. State lives in `localStorage`: `diagrams` (`[{ id, name, text }]`, one Monaco model each), `current`, `theme`, `split`. Loading lives in `diagrams.js` (no DOM, tested): the old `diagram` key becomes the first diagram, and a list that can't be read is copied to `diagrams-broken` before it can be overwritten.
  - Error line numbers: Mermaid counts lines after it strips the frontmatter, so `errorLocation` adds the frontmatter line count back.
  - `prepareSvg` replaces Mermaid's `width="100%"` and max-width with the real viewBox size. Pan/zoom and export depend on this.
  - `mermaid.render` gets `#render-tmp` (off-screen, outside the body grid) for its temporary element; in `<body>` it would add a grid row while rendering and shift the layout.
  - Monaco loads only the base editor worker. There are no language workers.
  - The code font is JetBrains Mono, bundled with `@fontsource/jetbrains-mono` (400 and 400 italic), used by the editor. `remeasureFonts()` runs once it has loaded.
- `mermaid-language.js` is the Monarch tokenizer and language config. `one-dark-pro.js` is the dark Monaco theme.
- Icon packs are registered once in `main.js` (`packs`). The same object goes to both Mermaid and autocomplete (architecture icon suggestions).

### Autocomplete (`completions/`)

`index.js` registers one completion provider. For each request it checks, in this order:
1. YAML frontmatter (`frontmatter.js`, which walks `config-schema.js`)
2. The diagram header line (`headers.js`, starter snippets)
3. A per-diagram module, chosen by matching `ctx.header.type` (the first content word) against each module's `matches` regex
4. `%%` comment and `%%{init}%%` starters

Module contract: `{ matches: RegExp, provide(ctx) -> items | null, init?(monaco, packs) }`. `charts.js` and `structure.js` export arrays of modules. `util.js` builds `ctx` (`before`, `header`, `item(typed)(label, opts)`, `collect(re)`, `range`) and has helpers (`snips`, `enums`, `openBraceLine`, `expandSnippet`). To add a diagram type, write a module and add it to `MODULES` in `index.js`.

Snippets are checked by `pnpm check`. Modules feed it through `docs()` (charts.js, structure.js: full example diagrams) or `SNIPPETS` plus `VALIDATE` (`prefix`, optional `around: { label: [before, after] }` for snippets that need context, `shapeCases`). A new module needs one of these to be checked.

`config-schema.js` was generated from `mermaid/dist/config.type.d.ts` (mermaid 12.2.0). Don't edit it by hand. The generator script is not in the repo.
