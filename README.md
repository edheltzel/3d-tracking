# Tracking Overlay

A 3D motion-tracking overlay drawn on one canvas: tracked boxes filled with ASCII, connector arcs, floating particles, and comets the tracker locks onto. Built with React, Vite and Tailwind CSS.

## Requirements

- Node.js 20.19+ or 22.12+
- pnpm

## Install

```sh
pnpm install
```

## Start

```sh
pnpm run dev
```

Open http://localhost:5173/.

## Build

```sh
pnpm run build
pnpm run preview
```

`build` writes to `dist/`; `preview` serves that build locally.

## Controls

| Input | Action |
| --- | --- |
| Drag | Rotate |
| Right-drag or Shift-drag | Pan |
| Scroll or pinch | Zoom |
| Double-click | Reset view |

The Colors panel (top right) sets the box, ASCII, line, comet lock and background colours. Choices are saved in the browser; Reset restores the defaults.

## Layout

- `src/app.tsx` - the page: overlay, Colors panel, control hints
- `src/variants/tracking-overlay.tsx` - the overlay itself
- `src/lib/` - shared motion helpers, components and fonts
- `assets/fonts/` - bundled web fonts
