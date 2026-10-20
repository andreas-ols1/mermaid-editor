# Mermaid editor

A browser-based editor for [Mermaid](https://mermaid.js.org/) diagrams. Write on the left, see the diagram on the right.

## Features

- Monaco editor with Mermaid syntax highlighting and autocomplete
- Live preview that updates as you type
- Errors are underlined in the editor
- Pan and zoom the preview. Double-click to fit it to the view.
- Copy as image, or download as PNG or SVG
- Open and save `.mmd` files with the toolbar buttons. Ctrl+S also saves, and you can drop a file on the page to open it.
- Light and dark theme
- Icon packs (`logos`, `mdi`) for architecture diagrams
- Your diagram, theme and layout are saved in the browser

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
