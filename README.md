# Map Art

Design printable map posters in the browser from OpenStreetMap data, then export a
print-ready JPEG. It's frontend-only, so you can deploy the `dist/` folder to any static host.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (scale math, graticule, JPEG dpi)
npm run build    # static site in dist/
```

## How it works

- **Data** (all public, no API keys):
  - Streets, water, land use and labels: [OpenFreeMap](https://openfreemap.org) vector tiles (OpenMapTiles schema)
  - Elevation: AWS Terrain Tiles (Terrarium), which [maplibre-contour](https://github.com/onthegomap/maplibre-contour) turns into contour lines
  - Search: [Nominatim](https://nominatim.org). Its usage policy allows at most 1 request/s, so the app searches only when you submit
- **What you see is what prints.** Layout runs in paper millimetres. The map is laid out at
  1 CSS px = 1/96 in of paper (times *Map detail*) and shrunk on screen with a CSS transform.
  The export builds a hidden map with the same CSS size and camera and a larger `pixelRatio`.
  Labels, line weights and the visible area match the preview exactly, just sharper.
- The frame (title, graticule, scale bar, attribution) is drawn on a 2D canvas in millimetres
  by the same function for preview and export.
- The exported JPEG has its JFIF density set to the chosen DPI, so it opens at the right physical size.
- Print scale (1:N) is real: it comes from the zoom, latitude and paper size. *Snap to print scale*
  sets the zoom for an exact 1:25 000, 1:50 000, and so on.

## Adding a new kind of map art

Implement `ArtStyle` (`src/types.ts`) and register it in `src/styles/registry.ts`. A style provides:

| member            | purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `defaults`, `controls`, `palettes` | its settings and the sidebar UI generated from them |
| `mapRect`         | where the map sits on the sheet (mm)                         |
| `mapStyle`        | MapLibre style JSON built from the settings                  |
| `drawOverlay`     | frame / title / legend drawn in mm on a canvas               |
| `fonts`           | fonts to load before drawing                                 |
| `textForPlace`    | text fields to fill when a place is picked in search         |

`src/styles/topographic/` is the reference implementation.

## Limits

The export renders the map as a single WebGL canvas. Its size is capped by the GPU, typically
16 384 px per side, which allows about A0 at 300 dpi. If the map needs more, the export stops
with a message suggesting a lower DPI. Very large exports (A0/A1) also need a lot of memory.

Map data © OpenStreetMap contributors. The attribution is printed on every poster.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` on every push to `main`.
One-time setup: in the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
The build uses relative asset paths (`base: './'`), so it works at `https://<user>.github.io/<repo>/` without further config.
