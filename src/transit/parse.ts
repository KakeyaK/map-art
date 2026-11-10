import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/** Kinds of public transport, in drawing/legend order (bottom → top in the map). */
export const MODES = ['bus', 'ferry', 'tram', 'train', 'light_rail', 'monorail', 'subway'] as const;
export type Mode = (typeof MODES)[number];

/** OSM `route=*` values for each mode. */
export const ROUTE_VALUES: Record<Mode, string[]> = {
  subway: ['subway'],
  monorail: ['monorail'],
  light_rail: ['light_rail'],
  train: ['train'],
  tram: ['tram'],
  bus: ['bus', 'trolleybus'],
  ferry: ['ferry'],
};

const routeToMode = new Map<string, Mode>(
  MODES.flatMap((m) => ROUTE_VALUES[m].map((r) => [r, m] as [string, Mode])),
);

/** Modes drawn as rail lines with stations. */
export const RAIL_MODES: Mode[] = ['subway', 'monorail', 'light_rail', 'train', 'tram'];

export interface TransitLine {
  key: string;
  mode: Mode;
  ref: string;
  /** Display name without the direction ("Linha 1-Azul", not "…: Tucuruvi → Jabaquara"). */
  name: string;
  colour: string | null;
  network: string;
  /** [west, south, east, north] of the line's geometry. */
  bbox: [number, number, number, number];
}

export interface TransitData {
  lines: TransitLine[];
  /** Line segments (one feature per OSM way and line) and stations. */
  geojson: FeatureCollection<LineString | Point>;
}

// Subset of Overpass JSON (`out geom` for relations, `out center tags` for stations).
interface OverpassMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  lat?: number;
  lon?: number;
  geometry?: ({ lat: number; lon: number } | null)[];
}
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  members?: OverpassMember[];
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

const COLOUR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** OSM `colour=*` to a CSS hex colour, or null when missing/unusable. */
export function normalizeColour(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim().split(';')[0].trim();
  if (COLOUR_RE.test(v)) return v.toLowerCase();
  if (/^([0-9a-f]{6})$/i.test(v)) return `#${v.toLowerCase()}`;
  const named: Record<string, string> = {
    red: '#e2231a', blue: '#0455a1', green: '#007e5e', yellow: '#f4d300', orange: '#f39200', purple: '#9b3894',
    silver: '#9e9e9e', grey: '#8a8a8a', gray: '#8a8a8a', brown: '#8b5a2b', pink: '#e86fa8', black: '#222222',
    white: '#ffffff', turquoise: '#00a9a6', lilac: '#a68cc4', violet: '#7b4fa0', cyan: '#00b5e2', gold: '#c9a227',
  };
  return named[v.toLowerCase()] ?? null;
}

/** "Linha 1-Azul: Tucuruvi → Jabaquara" → "Linha 1-Azul". */
export function lineName(tags: Record<string, string>): string {
  const raw = tags.name ?? tags.ref ?? '';
  const cut = raw.split(/\s*(?::|→|⇒|=>|->|<->|↔)\s*/)[0].trim();
  return cut || raw;
}

const lineKey = (mode: Mode, tags: Record<string, string>) =>
  [mode, tags.network ?? tags.operator ?? '', tags.ref || lineName(tags)].join('|');

/** Sort refs naturally: "2" < "10" < "A". */
const refCompare = (a: TransitLine, b: TransitLine) =>
  MODES.indexOf(b.mode) - MODES.indexOf(a.mode) ||
  a.ref.localeCompare(b.ref, undefined, { numeric: true }) ||
  a.name.localeCompare(b.name);

/** Squared distance in metres² between two lng/lat points (equirectangular, fine for < 1 km). */
function dist2(a: [number, number], b: [number, number]): number {
  const kx = 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const dx = (a[0] - b[0]) * kx;
  const dy = (a[1] - b[1]) * 110_574;
  return dx * dx + dy * dy;
}

const STATION_RADIUS_M = 300;

/**
 * Turns Overpass route relations into drawable lines. Each OSM way becomes one
 * feature per line that uses it, numbered so lines sharing track can be drawn
 * side by side (`slot`, centred on 0) like on a metro diagram.
 */
export function parseOverpass(res: OverpassResponse): TransitData {
  const lines = new Map<string, TransitLine>();
  /** way id → its geometry and the lines that use it. */
  const ways = new Map<number, { coords: [number, number][]; lines: Set<string> }>();
  /** Stop positions per line, used to tell which lines serve a station. */
  const stops: { line: string; at: [number, number] }[] = [];
  const stations: OverpassElement[] = [];

  for (const el of res.elements) {
    const tags = el.tags ?? {};
    if (el.type === 'relation' && tags.type === 'route') {
      const mode = routeToMode.get(tags.route);
      if (!mode) continue;
      const key = lineKey(mode, tags);
      let line = lines.get(key);
      if (!line) {
        line = {
          key, mode, ref: tags.ref ?? '', name: lineName(tags), colour: normalizeColour(tags.colour),
          network: tags.network ?? tags.operator ?? '', bbox: [Infinity, Infinity, -Infinity, -Infinity],
        };
        lines.set(key, line);
      } else if (!line.colour) {
        line.colour = normalizeColour(tags.colour);
      }
      for (const m of el.members ?? []) {
        if (m.type === 'way' && m.geometry && !m.role.startsWith('platform')) {
          const coords = m.geometry.filter((g): g is { lat: number; lon: number } => !!g).map((g) => [g.lon, g.lat] as [number, number]);
          if (coords.length < 2) continue;
          const w = ways.get(m.ref) ?? { coords, lines: new Set<string>() };
          w.lines.add(key);
          ways.set(m.ref, w);
          for (const [x, y] of coords) {
            line.bbox[0] = Math.min(line.bbox[0], x);
            line.bbox[1] = Math.min(line.bbox[1], y);
            line.bbox[2] = Math.max(line.bbox[2], x);
            line.bbox[3] = Math.max(line.bbox[3], y);
          }
        } else if (m.type === 'node' && m.role.startsWith('stop') && m.lat !== undefined && m.lon !== undefined) {
          stops.push({ line: key, at: [m.lon, m.lat] });
        }
      }
    } else if (tags.railway === 'station' || tags.railway === 'halt' || tags.public_transport === 'station' || tags.amenity === 'ferry_terminal') {
      stations.push(el);
    }
  }

  // Lines without geometry in the area (only stops) are dropped.
  for (const [key, line] of lines) if (!Number.isFinite(line.bbox[0])) lines.delete(key);

  const sorted = [...lines.values()].sort(refCompare);
  const order = new Map(sorted.map((l, i) => [l.key, i]));
  const features: Feature<LineString | Point>[] = [];

  for (const [id, w] of ways) {
    const using = [...w.lines].filter((k) => lines.has(k)).sort((a, b) => order.get(a)! - order.get(b)!);
    using.forEach((key, i) => {
      const l = lines.get(key)!;
      features.push({
        type: 'Feature',
        id: features.length,
        properties: {
          kind: 'line', way: id, line: key, mode: l.mode, ref: l.ref, name: l.name,
          colour: l.colour ?? '', slot: i - (using.length - 1) / 2, shared: using.length,
        },
        geometry: { type: 'LineString', coordinates: w.coords },
      });
    });
  }

  // Stations: dedupe (a station is often mapped as both node and area), find the lines serving each.
  const placed: { at: [number, number]; name: string }[] = [];
  const r2 = STATION_RADIUS_M ** 2;
  for (const st of stations) {
    const lat = st.lat ?? st.center?.lat;
    const lon = st.lon ?? st.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const at: [number, number] = [lon, lat];
    const name = st.tags?.name ?? '';
    if (placed.some((p) => p.name === name && dist2(p.at, at) < r2)) continue;
    const serving = new Set<string>();
    for (const s of stops) if (dist2(s.at, at) < r2) serving.add(s.line);
    const served = [...serving].filter((k) => lines.has(k)).sort((a, b) => order.get(a)! - order.get(b)!);
    const mode = served.length ? lines.get(served[0])!.mode : stationMode(st.tags ?? {});
    if (!mode) continue;
    placed.push({ at, name });
    const first = served.length ? lines.get(served[0])! : null;
    features.push({
      type: 'Feature',
      id: features.length,
      properties: {
        kind: 'station', name, mode, lines: served.length, colour: first?.colour ?? '',
        modes: [...new Set(served.map((k) => lines.get(k)!.mode))].join(','),
      },
      geometry: { type: 'Point', coordinates: at },
    });
  }

  return { lines: sorted, geojson: { type: 'FeatureCollection', features } };
}

function stationMode(tags: Record<string, string>): Mode | null {
  if (tags.amenity === 'ferry_terminal') return 'ferry';
  const st = tags.station;
  if (st === 'subway' || tags.subway === 'yes') return 'subway';
  if (st === 'monorail' || tags.monorail === 'yes') return 'monorail';
  if (st === 'light_rail' || tags.light_rail === 'yes') return 'light_rail';
  if (tags.tram === 'yes') return 'tram';
  if (tags.railway === 'station' || tags.railway === 'halt' || tags.train === 'yes') return 'train';
  return null;
}
