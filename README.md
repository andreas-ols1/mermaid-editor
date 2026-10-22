# Mermaid editor

A browser-based editor for [Mermaid](https://mermaid.js.org/) diagrams. Write on the left, see the diagram on the right.

## Features

- Monaco editor with Mermaid syntax highlighting and autocomplete
- Live preview that updates as you type
- Errors are underlined in the editor
- Pan and zoom the preview. Double-click to fit it to the view.
- Copy as image, or download as PNG, SVG or `.mmd` from the download menu
- Open `.mmd` files (as a new diagram) with the open button or by dropping them on the page. Ctrl+S saves.
- Light and dark theme
- Icon packs (`logos`, `mdi`) for architecture diagrams
- Several diagrams: switch, create (blank or from a template), rename and delete them from the menu at the left of the toolbar
- Your diagrams, theme and layout are saved in the browser

## Getting started

Requires [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev
```

Then open the URL that Vite prints.

To build a static version:

```sh
pnpm build    # outputs to dist/
pnpm preview  # serve the build locally
```

## Optional AI features

The editor can have an AI chat panel that creates and edits diagrams from a prompt in plain language. Each suggestion is checked by Mermaid and shown as a diff, and you accept or reject it. It is off by default: without configuration the editor shows no AI UI and sends nothing anywhere.

You need an OpenAI- or Anthropic-compatible endpoint that accepts OAuth (PKCE) access tokens, and a public OAuth client registered with the redirect URI `http://localhost/callback` (loopback, any port).

1. Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is ignored by git.
2. Run `pnpm dev` (or `pnpm build` and `pnpm preview`). API calls go through the Vite proxy, so AI works only there, not in a static deploy of `dist/`.
3. Open the AI panel with the sparkle button and sign in.

The diagram text is sent to the configured endpoint. Tokens are kept in the browser tab's session storage.
