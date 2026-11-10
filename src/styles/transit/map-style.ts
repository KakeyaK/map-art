import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { MODES, RAIL_MODES, type Mode } from '../../transit/parse';
import type { PaperSize, StyleConfig } from '../../types';
import { labelFactor } from '../topographic/labels';
import { enabledModes, fallbackColour, transitGeojsonUrl } from './data';

const OSM = 'openmaptiles';
const TRANSIT = 'transit';

/** Line weight per mode relative to the "line width" setting, in CSS px at zoom 12. */
const MODE_WIDTH: Record<Mode, number> = {
  subway: 4, monorail: 3.4, light_rail: 3.4, train: 3.4, tram: 2.6, ferry: 2.4, bus: 1,
};

/** Value that grows with zoom like a transit diagram: steady, then thicker when zoomed in. */
function zoomed(v: number): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.4], ['zoom'], 8, v * 0.45, 12, v, 16, v * 2.2];
}

/** Same zoom curve, with a per-feature factor inside each stop (style expressions need zoom outermost). */
function zoomedTimes(v: number, factor: ExpressionSpecification): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.4], ['zoom'], 8, ['*', factor, v * 0.45], 12, ['*', factor, v], 16, ['*', factor, v * 2.2]];
}

export function buildTransitStyle(c: StyleConfig, paper: PaperSize): StyleSpecification {
  const color = (key: string) => String(c[key]);
  const base = String(c.base);
  const lf = labelFactor(c, paper);
  const modes = new Set(enabledModes(c));
  const lw = Number(c.lineWidth);
  const mono = c.lineColors === 'mono';
  const lineColor = (mode: Mode): ExpressionSpecification | string => {
    if (mode === 'bus') return color('busColor');
    if (mode === 'ferry') return color('ferryColor');
    if (mono) return color('monoColor');
    return ['case', ['==', ['get', 'colour'], ''], fallbackColour(mode), ['get', 'colour']];
  };
  const isLine = (mode: Mode): FilterSpecification => ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'mode'], mode]];
  const offset = (w: number): ExpressionSpecification | number =>
    c.separateShared ? zoomedTimes(w * 1.05, ['to-number', ['get', 'slot']]) : 0;

  const layers: LayerSpecification[] = [{ id: 'paper', type: 'background', paint: { 'background-color': color('paper') } }];

  if (base !== 'none') {
    layers.push(
      {
        id: 'park',
        type: 'fill',
        source: OSM,
        'source-layer': 'park',
        paint: { 'fill-color': color('park'), 'fill-opacity': Number(c.parkOpacity) },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: OSM,
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'grass'], true, false],
        paint: { 'fill-color': color('park'), 'fill-opacity': Number(c.parkOpacity) * 0.7 },
      },
      {
        id: 'water',
        type: 'fill',
        source: OSM,
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': color('water') },
      },
    );
  }
  if (base === 'city') {
    layers.push(
      {
        id: 'roads-minor',
        type: 'line',
        source: OSM,
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['match', ['get', 'class'], ['minor', 'tertiary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color('road'),
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 0.2, 14, 0.8, 17, 3],
          'line-opacity': Number(c.roadOpacity),
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: OSM,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color('road'),
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.3, 12, 1.1, 16, 5],
          'line-opacity': Number(c.roadOpacity),
        },
      },
    );
  }
  if (base !== 'none' && c.showPlaceLabels) {
    layers.push({
      id: 'place-labels',
      type: 'symbol',
      source: OSM,
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'town', 'city'], true, false],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], ['city', 'town'], 13 * lf, 9 * lf],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-max-width': 8,
      },
      paint: { 'text-color': color('road'), 'text-opacity': 0.9, 'text-halo-color': color('paper'), 'text-halo-width': 1 },
    });
  }

  // Lines, bottom to top: buses under ferries under rail; each with a casing so crossings read clearly.
  for (const mode of MODES) {
    if (!modes.has(mode)) continue;
    const w = MODE_WIDTH[mode] * (mode === 'bus' ? Number(c.busWidth) : lw);
    if (mode !== 'bus' && Number(c.casingWidth) > 0) {
      layers.push({
        id: `casing-${mode}`,
        type: 'line',
        source: TRANSIT,
        filter: isLine(mode),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color('casing'),
          'line-width': zoomed(w + 2 * Number(c.casingWidth)),
          'line-offset': offset(w),
        },
      });
    }
    layers.push({
      id: `line-${mode}`,
      type: 'line',
      source: TRANSIT,
      filter: isLine(mode),
      layout: { 'line-cap': mode === 'ferry' ? 'butt' : 'round', 'line-join': 'round' },
      paint: {
        'line-color': lineColor(mode),
        'line-width': zoomed(w),
        'line-offset': mode === 'bus' ? 0 : offset(w),
        'line-opacity': mode === 'bus' ? Number(c.busOpacity) : 1,
        ...(mode === 'ferry' ? { 'line-dasharray': [2, 1.4] } : {}),
      },
    });
    // Suburban trains: a light dashed centre, the classic way to tell them from metro lines.
    if (mode === 'train' && c.trainStyle === 'striped') {
      layers.push({
        id: 'line-train-stripe',
        type: 'line',
        source: TRANSIT,
        filter: isLine('train'),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': color('casing'),
          'line-width': zoomed(w * 0.35),
          'line-offset': offset(w),
          'line-dasharray': [2, 2],
        },
      });
    }
  }

  const railShown = RAIL_MODES.filter((m) => modes.has(m));
  if (c.showLineLabels && railShown.length) {
    layers.push({
      id: 'line-labels',
      type: 'symbol',
      source: TRANSIT,
      filter: ['all', ['==', ['get', 'kind'], 'line'], ['match', ['get', 'mode'], railShown, true, false], ['!=', ['get', 'ref'], '']],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 280,
        'text-field': ['get', 'ref'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 9 * lf * Number(c.lineLabelSize),
        'text-keep-upright': true,
        'text-max-angle': 30,
      },
      paint: {
        'text-color': color('casing'),
        'text-halo-color': mono ? color('monoColor') : ['case', ['==', ['get', 'colour'], ''], '#555555', ['get', 'colour']],
        'text-halo-width': 2.4,
      },
    });
  }

  const stationModes = [...railShown, ...(modes.has('ferry') ? (['ferry'] as Mode[]) : [])];
  if (c.stationStyle !== 'none' && stationModes.length) {
    const r = 2.6 * Number(c.stationSize) * Math.max(0.6, lw);
    const interchange: ExpressionSpecification = ['>', ['get', 'lines'], 1];
    const stationColor: ExpressionSpecification | string = mono
      ? color('monoColor')
      : ['case', ['==', ['get', 'colour'], ''], color('stationStroke'), ['get', 'colour']];
    const dot = c.stationStyle === 'dot';
    layers.push({
      id: 'stations',
      type: 'circle',
      source: TRANSIT,
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['match', ['get', 'mode'], stationModes, true, false]],
      paint: {
        'circle-radius': ['interpolate', ['exponential', 1.4], ['zoom'], 8, ['case', interchange, r * 0.6, r * 0.45], 12, ['case', interchange, r * 1.35, r], 16, ['case', interchange, r * 2.6, r * 2]],
        'circle-color': dot ? ['case', interchange, color('stationFill'), stationColor] : color('stationFill'),
        'circle-stroke-color': ['case', interchange, color('stationStroke'), dot ? color('stationFill') : stationColor],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1.4, 16, 2.4],
      },
    });
  }
  if (c.showStationLabels && stationModes.length) {
    layers.push({
      id: 'station-labels',
      type: 'symbol',
      source: TRANSIT,
      minzoom: Number(c.stationLabelMinZoom),
      filter: ['all', ['==', ['get', 'kind'], 'station'], ['match', ['get', 'mode'], stationModes, true, false]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['case', ['>', ['get', 'lines'], 1], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
        'text-size': ['case', ['>', ['get', 'lines'], 1], 10 * lf * Number(c.stationLabelSize), 9 * lf * Number(c.stationLabelSize)],
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.8,
        'text-justify': 'auto',
        'text-max-width': 9,
        'text-transform': c.stationUppercase ? 'uppercase' : 'none',
      },
      paint: { 'text-color': color('label'), 'text-halo-color': color('halo'), 'text-halo-width': 1.3 },
    });
  }

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      [OSM]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      [TRANSIT]: { type: 'geojson', data: transitGeojsonUrl() },
    },
    layers,
  };
}
