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

## Art styles

- **Topographic survey**: survey-sheet look with contours, graticule and scale.
- **Public transport**: metro, suburban train, monorail/light rail, tram, ferry and bus lines in their
  official colours, with stations, interchanges and an automatic legend. The background can be a quiet
  city map, just water and parks, or nothing at all (lines only).

Both share the same frame (title, notes, legend, scale, borders...), set from the sidebar.

## How it works

- **Data** (all public, no API keys):
  - Streets, water, land use and labels: [OpenFreeMap](https://openfreemap.org) vector tiles (OpenMapTiles schema)
  - Elevation: AWS Terrain Tiles (Terrarium), which [maplibre-contour](https://github.com/onthegomap/maplibre-contour) turns into contour lines
  - Public transport: OpenStreetMap route relations through the [Overpass API](https://overpass-api.de).
    It's one source for the whole world; quality depends on how well a city's lines are mapped in OSM.
    Answers are cached in the browser for a week. Buses load only when zoomed in, since big cities
    have thousands of routes
  - Search: [Nominatim](https://nominatim.org). Its usage policy allows at most 1 request/s, so the app searches only when you submit
- **What you see is what prints.** Layout runs in paper millimetres. The map is laid out at
  1 CSS px = 1/96 in of paper (times *Map detail*) and shrunk on screen with a CSS transform.
  The export builds a hidden map with the same CSS size and camera and a larger `pixelRatio`.
  Labels, line weights and the visible area match the preview exactly, just sharper.
- The frame (title, graticule, scale bar, attribution) is drawn on a 2D canvas in millimetres
  by the same function for preview and export.
- The exported JPEG has its JFIF density set to the chosen DPI, so it opens at the right physical size.
- **Themes**: 20 built-in looks (colours plus fonts, fills and sheet border). Every colour and
  fill can be tweaked, and *Save current look as a theme* keeps your own themes in the browser.
- **Frame elements** (title, subtitle, three notes, scale, north arrow, attribution) each have a
  position: the band above or below the map, a corner of the map itself, or hidden. Borders are set
  per side (0 = the map reaches the sheet edge), so a sheet can have a full frame, a bottom band
  only, or none at all. *Quick layouts* apply common arrangements in one click.
- **Map label size**: MapLibre lays labels out at a fixed physical size, which looks huge on small
  sheets (A5/A6). By default labels now scale with the sheet (√ of the short side relative to A3),
  and *Map labels* has a size slider for every kind of label.
- Print scale (1:N) is real: it comes from the zoom, latitude and paper size. *Snap to print scale*
  sets the zoom for an exact 1:25 000, 1:50 000, and so on.

## Adding a new kind of map art

Implement `ArtStyle` (`src/types.ts`) and register it in `src/styles/registry.ts`. A style provides:

| member            | purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `defaults`, `controls`, `palettes` | its settings and the sidebar UI generated from them |
| `mapRect`         | where the map sits on the sheet (mm)                         |
| `themeKeys`, `swatchKeys` | which settings a theme sets / shows as swatches      |
| `mapStyle`        | MapLibre style JSON built from the settings and paper size   |
| `sheetColor`      | colour of the sheet outside the map                          |
| `migrate`         | optional upgrade of settings saved by older versions         |
| `drawOverlay`     | frame / title / legend drawn in mm on a canvas               |
| `fonts`           | fonts to load before drawing                                 |
| `textForPlace`    | text fields to fill when a place is picked in search         |
| `data`            | optional: fetch data for the visible area (see `styles/transit/data.ts`) |

`src/styles/topographic/` is the reference implementation. Styles that use `drawFrame` /
`frameControls` from `src/frame/` get the configurable frame for free.

## Limits

The export renders the map as a single WebGL canvas. Its size is capped by the GPU, typically
16 384 px per side, which allows about A0 at 300 dpi. If the map needs more, the export stops
with a message suggesting a lower DPI. Very large exports (A0/A1) also need a lot of memory.

Map data © OpenStreetMap contributors. The attribution is printed on every poster.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` on every push to `main`.
One-time setup: in the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
The build uses relative asset paths (`base: './'`), so it works at `https://<user>.github.io/<repo>/` without further config.
