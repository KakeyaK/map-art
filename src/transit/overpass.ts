import { ROUTE_VALUES, RAIL_MODES, type Mode, type OverpassResponse } from './parse';

/**
 * Public transport comes from OpenStreetMap through the Overpass API: one source
 * that works for any city in the world (lines are OSM route relations, tagged
 * with their official colour). Coverage depends on how well a city is mapped.
 */
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export type BBox = [west: number, south: number, east: number, north: number];

/** Snap outwards to a 0.05° grid so small pans reuse the same (cached) query. */
export function snapBBox([w, s, e, n]: BBox, step = 0.05): BBox {
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(down(w)), r(down(s)), r(up(e)), r(up(n))];
}

export function buildQuery(bbox: BBox, modes: Mode[]): string {
  const [w, s, e, n] = bbox;
  const b = `(${s},${w},${n},${e})`;
  const routes = [...new Set(modes.flatMap((m) => ROUTE_VALUES[m]))].sort().join('|');
  const wantStations = modes.some((m) => RAIL_MODES.includes(m));
  const wantFerry = modes.includes('ferry');
  return [
    '[out:json][timeout:120];',
    `relation["type"="route"]["route"~"^(${routes})$"]${b};`,
    'out geom;',
    wantStations || wantFerry
      ? `(${wantStations ? `nwr["railway"~"^(station|halt)$"]${b};` : ''}${wantFerry ? `nwr["amenity"="ferry_terminal"]${b};` : ''});out center tags;`
      : '',
  ].join('');
}

const CACHE = 'map-art-overpass-v1';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const TIMEOUT_MS = 130_000;

/** Fetches from Overpass, trying each endpoint, and keeps answers for a week in the browser cache. */
export async function fetchOverpass(query: string, signal?: AbortSignal): Promise<OverpassResponse> {
  const cacheKey = `https://overpass.cache/${encodeURIComponent(query)}`;
  const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE).catch(() => undefined);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit && Date.now() - Number(hit.headers.get('x-fetched') ?? 0) < MAX_AGE_MS) return hit.json();

  let lastError: unknown;
  for (const url of ENDPOINTS) {
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!res.ok) throw new Error(res.status === 429 ? 'Overpass is busy (too many requests)' : `Overpass error ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text) as OverpassResponse & { remark?: string };
      if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new Error('Overpass timed out — zoom in a little');
      await cache
        ?.put(cacheKey, new Response(text, { headers: { 'content-type': 'application/json', 'x-fetched': String(Date.now()) } }))
        .catch(() => undefined);
      return json;
    } catch (err) {
      if (signal?.aborted) throw err;
      if ((err as Error).name === 'TimeoutError') err = new Error('Overpass took too long — zoom in a little');
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not reach Overpass');
}
