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
- Several diagrams: switch, create, rename and delete them from the menu at the left of the toolbar
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
