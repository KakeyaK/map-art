import type { LegendItem } from '../../frame/frame';
import { buildQuery, fetchOverpass, snapBBox, type BBox } from '../../transit/overpass';
import { MODES, parseOverpass, type Mode, type TransitData, type TransitLine } from '../../transit/parse';
import type { StyleConfig, StyleData } from '../../types';

/** Config toggle for each mode. Light rail and monorail share one. */
export const MODE_TOGGLES: Record<Mode, string> = {
  subway: 'showSubway',
  monorail: 'showMonorail',
  light_rail: 'showMonorail',
  train: 'showTrain',
  tram: 'showTram',
  bus: 'showBus',
  ferry: 'showFerry',
};

export const enabledModes = (c: StyleConfig): Mode[] => MODES.filter((m) => Boolean(c[MODE_TOGGLES[m]]));

/** Largest area (square degrees) fetched at once; Overpass struggles beyond it. */
const MAX_RAIL_AREA = 2.5;
/** Big cities have thousands of bus routes, so buses load only over a small area. */
const MAX_BUS_AREA = 0.04;

const area = ([w, s, e, n]: BBox) => (e - w) * (n - s);
const contains = (outer: BBox, inner: BBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const intersects = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function pad([w, s, e, n]: BBox, f: number): BBox {
  const dx = (e - w) * f;
  const dy = (n - s) * f;
  return [w - dx, s - dy, e + dx, n + dy];
}

interface Loaded {
  bbox: BBox;
  modes: string;
  data: TransitData;
  url: string;
}

const EMPTY: TransitData = { lines: [], geojson: { type: 'FeatureCollection', features: [] } };
let loaded: Loaded | null = null;
let viewBounds: BBox | null = null;
let emptyUrl = '';
let statusToken = 0;

function blobUrl(data: TransitData): string {
  return URL.createObjectURL(new Blob([JSON.stringify(data.geojson)], { type: 'application/json' }));
}

/**
 * GeoJSON URL for the map style. A blob URL keeps the style small, so every
 * slider change doesn't re-send (and re-compare) megabytes of line geometry.
 */
export function transitGeojsonUrl(): string {
  if (loaded) return loaded.url;
  emptyUrl ||= blobUrl(EMPTY);
  return emptyUrl;
}

const FALLBACK: Record<Mode, string> = {
  subway: '#3a5ba9', monorail: '#8a8d91', light_rail: '#2f9e8f', train: '#7a2e8e', tram: '#d1495b', bus: '#666666', ferry: '#1f6fae',
};

/** Colour a line is drawn with, following the "line colours" setting. */
export function lineColour(line: Pick<TransitLine, 'colour' | 'mode'>, c: StyleConfig): string {
  if (line.mode === 'bus') return String(c.busColor);
  if (line.mode === 'ferry') return String(c.ferryColor);
  if (c.lineColors === 'mono') return String(c.monoColor);
  return line.colour ?? FALLBACK[line.mode];
}

export const fallbackColour = (mode: Mode) => FALLBACK[mode];

/** Lines shown in the legend: those crossing the visible map, rail first. */
export function transitLegend(c: StyleConfig): LegendItem[] {
  if (!loaded || !viewBounds) return [];
  const modes = new Set(enabledModes(c));
  const items: LegendItem[] = [];
  const seen = new Set<string>();
  let buses = 0;
  for (const line of loaded.data.lines) {
    if (!modes.has(line.mode) || !intersects(line.bbox, viewBounds)) continue;
    if (line.mode === 'bus') {
      buses++;
      continue;
    }
    const colour = lineColour(line, c);
    const label = c.legendLabel === 'ref' && line.ref ? line.ref : line.name;
    const id = `${label}|${colour}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      color: colour,
      ref: line.ref.length <= 3 ? line.ref : '',
      label,
      kind: line.mode === 'ferry' ? 'dashed' : 'line',
    });
  }
  if (buses) items.push({ color: String(c.busColor), ref: '', label: `${String(c.busLegendLabel || 'Bus routes')} (${buses})`, kind: 'thin' });
  return items;
}

const legendKey = (c: StyleConfig) => JSON.stringify(transitLegend(c));

export const transitData: StyleData = {
  async sync(view, c, signal, report) {
    // Only the latest message may be cleared by its own timer.
    const token = ++statusToken;
    const status: typeof report = (s) => {
      if (token === statusToken) report(s);
    };
    const before = legendKey(c);
    viewBounds = view.bounds;
    const modes = enabledModes(c);
    if (!modes.length) {
      status({ state: 'idle', message: '' });
      return legendKey(c) !== before;
    }
    let want = snapBBox(pad(view.bounds, 0.5));
    let fetchModes = modes;
    let note = '';
    if (modes.includes('bus') && area(want) > MAX_BUS_AREA) {
      const tight = snapBBox(pad(view.bounds, 0.1), 0.01);
      if (area(tight) <= MAX_BUS_AREA) want = tight;
      else {
        fetchModes = modes.filter((m) => m !== 'bus');
        note = ' Zoom in to load bus routes.';
      }
    }
    if (area(want) > MAX_RAIL_AREA) {
      status({ state: 'error', message: 'Zoom in to load public transport (the area is too large).' });
      return legendKey(c) !== before;
    }
    const modesKey = fetchModes.join(',');
    if (loaded && loaded.modes === modesKey && contains(loaded.bbox, snapBBox(view.bounds))) {
      status({ state: note ? 'error' : 'idle', message: note.trim() });
      return legendKey(c) !== before;
    }
    if (!fetchModes.length) {
      status({ state: 'error', message: note.trim() });
      return legendKey(c) !== before;
    }

    status({ state: 'loading', message: 'Loading public transport from OpenStreetMap…' });
    const json = await fetchOverpass(buildQuery(want, fetchModes), signal);
    const data = parseOverpass(json);
    const previous = loaded;
    loaded = { bbox: want, modes: modesKey, data, url: blobUrl(data) };
    // The old URL may still be loading in a map; free it a little later.
    if (previous) setTimeout(() => URL.revokeObjectURL(previous.url), 60_000);
    const lineCount = data.lines.filter((l) => l.mode !== 'bus').length;
    status({
      state: note ? 'error' : lineCount || data.lines.length ? 'ok' : 'error',
      message: (data.lines.length ? `${data.lines.length} lines loaded.` : 'No public transport lines mapped here.') + note,
    });
    setTimeout(() => status({ state: 'idle', message: '' }), note ? 6000 : 2500);
    return true;
  },
};
