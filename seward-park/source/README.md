# Seward Park

An interactive 3D diorama of the table tennis area at Seward Park in New York City. The viewer includes day and night lighting, a gentle breeze, falling leaves, and an OBJ download.

![Seward Park diorama](public/screenshot.jpeg)

## Run locally

Use Node.js 24 and pnpm 11.19.0:

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Controls

- Drag to orbit; scroll or pinch to zoom; right-drag to pan.
- Click the scene, then use the arrow keys or WASD to move in the direction you are looking. Left and right strafe.
- Drag while moving to look around. Q/E move down/up. Shift moves faster.
- Escape returns to orbit. Zero or the reset button returns to the overview.
- The moon/sun button or N switches between day and night.
- The download button saves the OBJ model and its material library.
- Reduced-motion preferences keep the trees and falling leaves still.

## Validate

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Deployment

This project publishes a static website on GitHub Pages. It requires no database, backend server, or external API.

Run `pnpm build:pages` to build for `/seward-park/`. The generated `out` directory is published as the `seward-park` folder of `willieip/willieip.github.io`. The complete editable website source is in that folder's `source` directory.

The build sets `NEXT_PUBLIC_BASE_PATH` so the model, decoder, favicon, and download use the correct address. Local development uses the site root by default. GitHub Pages includes `seward-park/_next` through the repository's Jekyll configuration.

## Assets

- `public/park.glb` contains the compressed scene used by the viewer.
- `public/draco/` contains the local geometry decoder.
- `public/downloads/seward-park-obj.zip` contains the downloadable OBJ model and MTL material library.
- The Three.js scene, camera movement, and wind animation are in `app/`.
