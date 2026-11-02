import type { LngLat } from './types';

const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** MapLibre's world size at zoom 0, in CSS pixels. */
const TILE_SIZE = 512;

export function metersPerCssPx(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

/** Scale denominator (1:N) for a map printed with `cssPxPerMm` CSS pixels per paper mm. */
export function scaleDenominator(lat: number, zoom: number, cssPxPerMm: number): number {
  const groundMetersPerPaperMm = metersPerCssPx(lat, zoom) * cssPxPerMm;
  return groundMetersPerPaperMm * 1000;
}

/** Inverse of `scaleDenominator`: the zoom that prints at exactly 1:N. */
export function zoomForScale(lat: number, scale: number, cssPxPerMm: number): number {
  const metersPerPx = scale / 1000 / cssPxPerMm;
  return Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * metersPerPx));
}

/** 48 523 → "1:48 500" (three significant digits, thin-space thousands). */
export function formatScale(scale: number): string {
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(scale)) - 2);
  const rounded = Math.round(scale / magnitude) * magnitude;
  return `1:${groupThousands(rounded)}`;
}

export function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Largest 1/2/5 × 10^n not greater than `value`. */
export function niceFloor(value: number): number {
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return nice * exp;
}

/** Graticule steps in degrees: minutes first, then whole degrees. */
const GRATICULE_STEPS = [1, 2, 5, 10, 15, 20, 30].map((m) => m / 60).concat([1, 2, 5, 10, 15, 30]);

/** Smallest graticule step that yields at most `maxLines` lines across `span` degrees. */
export function graticuleStep(span: number, maxLines: number): number {
  return GRATICULE_STEPS.find((s) => span / s <= maxLines) ?? GRATICULE_STEPS[GRATICULE_STEPS.length - 1];
}

export function graticuleValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  // Work in integer arc-seconds to avoid floating drift (e.g. 46°39'59.999").
  const stepS = Math.round(step * 3600);
  for (let s = Math.ceil((min * 3600) / stepS) * stepS; s <= max * 3600; s += stepS) out.push(s / 3600);
  return out;
}

/** 46.6667, 'lng' → "46°40'W"; minutes omitted on whole degrees when `compact`. */
export function formatDegrees(value: number, axis: 'lng' | 'lat', compact = false): string {
  const hemi = axis === 'lng' ? (value < 0 ? 'W' : 'E') : value < 0 ? 'S' : 'N';
  const totalMin = Math.round(Math.abs(value) * 60);
  const deg = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const minPart = compact && min === 0 ? '' : `${String(min).padStart(2, '0')}'`;
  return `${deg}°${minPart}${hemi}`;
}

/**
 * Parses "lat, lng" or "lat, lng, zoom" (also accepts spaces/semicolons).
 * Returns null when the text isn't a coordinate pair.
 */
export function parseCoordinates(text: string): { center: LngLat; zoom?: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)(?:[\s,;]+(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const zoom = m[3] === undefined ? undefined : Number(m[3]);
  return { center: [lng, lat], zoom };
}
