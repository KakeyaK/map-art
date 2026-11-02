import type { Map as MapLibreMap } from 'maplibre-gl';
import { scaleDenominator } from './geo';
import { cssPxPerMm } from './paper';
import type { OverlayScene, PaperSize, RectMm } from './types';

/** Logical (CSS pixel) size of the map for a map window of `rect` millimetres. */
export function mapCssSize(rect: RectMm, detail: number): [number, number] {
  const d = cssPxPerMm(detail);
  return [Math.max(1, Math.round(rect.w * d)), Math.max(1, Math.round(rect.h * d))];
}

/**
 * Bridges a MapLibre map laid out at `detail` CSS px per mm to paper millimetres.
 * Preview and export share this, which is what keeps them identical.
 */
export function buildScene(
  map: MapLibreMap,
  paper: PaperSize,
  mapRect: RectMm,
  detail: number,
  pxPerMm: number,
): OverlayScene {
  const [cssW, cssH] = mapCssSize(mapRect, detail);
  // Rounding the CSS size makes px/mm differ a hair per axis; honour both.
  const sx = cssW / mapRect.w;
  const sy = cssH / mapRect.h;
  const c = map.getCenter();
  const zoom = map.getZoom();
  return {
    paper,
    mapRect,
    pxPerMm,
    center: [c.lng, c.lat],
    zoom,
    scale: scaleDenominator(c.lat, zoom, cssPxPerMm(detail)),
    project: ([lng, lat]) => {
      const p = map.project([lng, lat]);
      return [mapRect.x + p.x / sx, mapRect.y + p.y / sy];
    },
    unproject: (x, y) => {
      const ll = map.unproject([(x - mapRect.x) * sx, (y - mapRect.y) * sy]);
      return [ll.lng, ll.lat];
    },
  };
}

export async function loadFonts(fonts: string[]): Promise<void> {
  await Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => [])));
}
