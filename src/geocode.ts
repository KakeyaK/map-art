import type { LngLat } from './types';

export interface Place {
  name: string;
  label: string;
  center: LngLat;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
}

interface NominatimResult {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // south, north, west, east
}

/** OpenStreetMap Nominatim. Usage policy: ≤1 request/s, no autocomplete — search on submit only. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', navigator.language);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => {
    const [south, north, west, east] = r.boundingbox.map(Number);
    return {
      name: r.name || r.display_name.split(',')[0],
      label: r.display_name,
      center: [Number(r.lon), Number(r.lat)],
      bbox: [west, south, east, north],
    };
  });
}
