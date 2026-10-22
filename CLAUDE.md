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

- `index.html` holds the layout and all CSS. The theme uses CSS variables switched by `data-theme` on `<html>`. Colours are semantic tokens in `:root` for both themes (`--control-*` for buttons and inputs, `--primary-*` for the one main action, `--danger`, `--accent` for dividers and focus, `--muted`); use them instead of hex values. Text tokens reach 4.5:1, control borders 3:1.
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

### Optional AI chat (`ai/`)

Off unless configured. Env (see `.env.example`; real values only in `.env.local`, which is ignored): `AI_TARGET` (proxy target, not exposed to the browser), `VITE_AI_ISSUER`, `VITE_AI_CLIENT_ID`, `VITE_AI_SCOPE`, `VITE_AI_MODEL`, `VITE_AI_FORMAT` (`openai` or `anthropic`). There are no defaults in code. Tracked files must not contain real endpoint, client or model values, or company names: `pnpm check` enforces this.

`vite.config.js` exists only for the optional AI features. Without `AI_TARGET` it returns `{}`. With it, `pnpm dev` and `pnpm preview` proxy `/ai/v1/*` to `AI_TARGET` (the API sends no CORS headers), serve `callback.html` at `/callback` (the OAuth redirect path must match exactly), add `callback.html` to the build, and define `import.meta.env.AI_PROXY`. A static build has no proxy, so no AI.

Layers (features never know the provider):
- `config.js`: reads env. `aiEnabled` is false unless the proxy and all values are present. `main.js` loads the other `ai/` modules with dynamic `import()` only when it is true.
- `auth.js`: OAuth authorization code + PKCE (S256), public client. Endpoints from RFC 8414 discovery. Sign-in in a popup; `callback.html` posts `{ code, state }` back (opener `postMessage` and a `BroadcastChannel`, same origin only), and `state` is checked. The token endpoint is called directly (it allows CORS). Tokens in `sessionStorage`, refreshed 60 s before expiry and once after a 401; a failed refresh signs out. Never log tokens.
- `provider.js`: `complete({ system, messages, signal })` to `/ai/v1/chat/completions` (openai) or `/ai/v1/messages` (anthropic), `max_tokens` 4096, no streaming. Errors carry `status`.
- `prompts.js`, `chat.js`: one chat turn. The current text (and its Mermaid error, if any) is sent every turn, with the last 4 messages as history. The first ```mermaid block is checked with `mermaid.parse`; if it fails, the error goes back to the model (at most 2 repair rounds).
- `review.js`: diff overlay (`createDiffEditor`, temporary models, the main editor's font). Accept applies the change in `main.js` as one undo step (`pushUndoStop` / `executeEdits` / `pushUndoStop`), but not if the text changed since the request. "Open as new diagram" creates a new diagram instead.

Model output is untrusted: only `textContent` and Monaco models, never `innerHTML`. Keep Mermaid's default `securityLevel`. The panel's width is dragged with `#chat-divider` (the same `makeDivider` helper as the editor divider). Extra `localStorage` keys: `chat` (panel open), `chat-width`, `ai-notice` (the one-time notice was dismissed).
