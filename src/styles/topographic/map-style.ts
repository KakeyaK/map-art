import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { demSource } from '../../dem';
import type { PaperSize, StyleConfig } from '../../types';
import { labelFactor } from './labels';

const OSM = 'openmaptiles';

/** Contour intervals in metres, [minor, major] per zoom. */
const CONTOUR_THRESHOLDS: Record<string, Record<number, [number, number]>> = {
  coarse: { 9: [200, 1000], 10: [100, 500], 11: [50, 250], 12: [50, 250], 13: [20, 100], 14: [20, 100], 15: [10, 50] },
  normal: { 9: [100, 500], 10: [50, 250], 11: [25, 100], 12: [20, 100], 13: [10, 50], 14: [10, 50], 15: [5, 25] },
  fine: { 9: [50, 250], 10: [25, 100], 11: [10, 50], 12: [10, 50], 13: [5, 25], 14: [5, 25], 15: [2, 10] },
};

const URBAN_CLASSES = [
  'residential', 'commercial', 'industrial', 'retail', 'railway', 'suburb', 'quarter', 'neighbourhood',
  'garages', 'hospital', 'school', 'university', 'college', 'kindergarten', 'bus_station', 'military', 'library',
];
const GREEN_LANDUSE = ['cemetery', 'pitch', 'playground', 'stadium', 'zoo', 'theme_park', 'track'];

/** Line width that grows with zoom; `stops` are [zoom, width] pairs, scaled by `k`. */
function width(k: number, ...stops: [number, number][]): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flatMap(([z, w]) => [z, w * k])] as ExpressionSpecification;
}

/**
 * Zoom curve whose value at each stop depends on the feature's class. Style
 * expressions allow only one top-level zoom interpolation, so the class match
 * goes inside each stop. `values` are aligned with `zooms`.
 */
function byClassOverZoom(
  zooms: number[],
  cases: Record<string, number[]>,
  fallback: number[],
  curve: ExpressionSpecification[1] = ['exponential', 1.5],
): ExpressionSpecification {
  const stops = zooms.flatMap((z, i) => [
    z,
    ['match', ['get', 'class'], ...Object.entries(cases).flatMap(([cls, v]) => [cls, v[i]]), fallback[i]],
  ]);
  return ['interpolate', curve, ['zoom'], ...stops] as ExpressionSpecification;
}

const roadClass =(...classes: string[]): FilterSpecification => [
  'all',
  ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
  ['match', ['get', 'class'], classes, true, false],
  ['!=', ['get', 'brunnel'], 'tunnel'],
];

function nameField(lang: string): ExpressionSpecification {
  return lang === 'local' ? ['get', 'name'] : ['coalesce', ['get', `name:${lang}`], ['get', 'name']];
}

export function buildMapStyle(c: StyleConfig, paper: PaperSize): StyleSpecification {
  const k = Number(c.roadWidth);
  const name = nameField(String(c.labelLanguage));
  const color = (key: string) => String(c[key]);
  const visible = (key: string) => ({ visibility: c[key] ? 'visible' : 'none' }) as const;
  const lf = labelFactor(c, paper);
  /** Label size multiplier for one kind of label. */
  const size = (key: string) => lf * Number(c[key] ?? 1);
  const halo = (w: number) => w * Number(c.haloWidth ?? 1);
  const upper = c.placeUppercase ? 'uppercase' : 'none';

  const layers: LayerSpecification[] = [
    { id: 'paper', type: 'background', paint: { 'background-color': color('paper') } },
    {
      id: 'urban',
      type: 'fill',
      source: OSM,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], URBAN_CLASSES, true, false],
      paint: { 'fill-color': color('urban'), 'fill-opacity': Number(c.urbanOpacity), 'fill-antialias': false },
    },
    {
      id: 'green-landcover',
      type: 'fill',
      source: OSM,
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'grass', 'wetland'], true, false],
      layout: visible('showParks'),
      paint: { 'fill-color': color('park'), 'fill-opacity': 0.75 * Number(c.parkOpacity) },
    },
    {
      id: 'green-landuse',
      type: 'fill',
      source: OSM,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], GREEN_LANDUSE, true, false],
      layout: visible('showParks'),
      paint: { 'fill-color': color('park'), 'fill-opacity': Number(c.parkOpacity) },
    },
    {
      id: 'park',
      type: 'fill',
      source: OSM,
      'source-layer': 'park',
      layout: visible('showParks'),
      paint: { 'fill-color': color('park'), 'fill-opacity': Number(c.parkOpacity), 'fill-outline-color': color('contour') },
    },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      layout: visible('showHillshade'),
      paint: {
        'hillshade-exaggeration': Math.min(1, 0.35 * Number(c.hillshadeStrength ?? 1)),
        'hillshade-shadow-color': color('hillshadeShadow') + '59',
        'hillshade-highlight-color': 'rgba(255,255,255,0.15)',
        'hillshade-accent-color': 'rgba(0,0,0,0)',
      },
    },
    {
      id: 'contours',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      layout: { ...visible('showContours'), 'line-join': 'round' },
      paint: {
        'line-color': color('contour'),
        'line-width': ['match', ['get', 'level'], 1, 0.9 * Number(c.contourWidth), 0.45 * Number(c.contourWidth)],
        'line-opacity': ['match', ['get', 'level'], 1, 0.9 * Number(c.contourOpacity), 0.65 * Number(c.contourOpacity)],
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: OSM,
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': color('water') },
    },
    {
      id: 'water-outline',
      type: 'line',
      source: OSM,
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      layout: { visibility: Number(c.waterLineWidth) > 0 ? 'visible' : 'none' },
      paint: { 'line-color': color('waterLine'), 'line-width': width(Math.max(0.01, Number(c.waterLineWidth)), [10, 0.3], [14, 0.8], [18, 2]) },
    },
    {
      id: 'waterway',
      type: 'line',
      source: OSM,
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color('waterLine'),
        'line-width': byClassOverZoom([8, 11, 14, 18], { river: [0.6, 1.2, 2.5, 6] }, [0, 0.3, 0.7, 2.5]),
      },
    },
    {
      id: 'aeroway',
      type: 'line',
      source: OSM,
      'source-layer': 'aeroway',
      minzoom: 10,
      filter: ['match', ['get', 'class'], ['runway', 'taxiway'], true, false],
      paint: {
        'line-color': color('minorRoad'),
        'line-width': byClassOverZoom([10, 14, 18], { runway: [1, 8, 60] }, [0.3, 1.5, 12]),
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: OSM,
      'source-layer': 'building',
      minzoom: 13,
      layout: visible('showBuildings'),
      paint: { 'fill-color': color('building'), 'fill-opacity': Number(c.buildingOpacity), 'fill-antialias': true },
    },
    {
      id: 'road-service',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: roadClass('service', 'track'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color('minorRoad'), 'line-width': width(k, [13, 0.1], [15, 0.6], [18, 2.5]), 'line-opacity': 0.8 },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 11,
      filter: roadClass('minor'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color('minorRoad'), 'line-width': width(k, [11, 0.15], [13, 0.45], [15, 1.3], [18, 5]) },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 8,
      filter: roadClass('secondary', 'tertiary'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color('road'), 'line-width': width(k, [8, 0.2], [12, 0.8], [15, 2.4], [18, 8]) },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 6,
      filter: roadClass('primary', 'trunk'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color('road'), 'line-width': width(k, [6, 0.3], [12, 1.3], [15, 3.4], [18, 11]) },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 5,
      filter: roadClass('motorway'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color('motorway'), 'line-width': width(k, [5, 0.4], [12, 2], [15, 5], [18, 15]) },
    },
    // Hollow centre gives motorways the double-line look of survey maps.
    {
      id: 'road-motorway-inner',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 11,
      filter: roadClass('motorway'),
      layout: { 'line-cap': 'round', 'line-join': 'round', ...visible('motorwayCasing') },
      paint: { 'line-color': color('urban'), 'line-width': width(k, [11, 0.3], [12, 0.8], [15, 2.6], [18, 9]) },
    },
    {
      id: 'rail',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      filter: ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: visible('showRail'),
      paint: { 'line-color': color('rail'), 'line-width': width(1, [8, 0.3], [13, 0.8], [17, 2]) },
    },
    {
      id: 'rail-hatching',
      type: 'line',
      source: OSM,
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: visible('showRail'),
      paint: { 'line-color': color('rail'), 'line-width': width(1, [13, 2.5], [17, 6]), 'line-dasharray': [0.15, 3] },
    },
    {
      id: 'contour-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['>', ['get', 'level'], 0],
      layout: {
        ...visible('showContourLabels'),
        'symbol-placement': 'line',
        'text-field': ['number-format', ['get', 'ele'], {}],
        'text-font': ['Noto Sans Regular'],
        'text-size': 8 * size('contourLabelSize'),
        'text-max-angle': 25,
      },
      paint: { 'text-color': color('contour'), 'text-halo-color': color('halo'), 'text-halo-width': halo(1) },
    },
    ...(['point', 'line'] as const).map(
      (placement): LayerSpecification => ({
        id: `water-labels-${placement}`,
        type: 'symbol',
        source: OSM,
        'source-layer': 'water_name',
        filter: [
          'match', ['geometry-type'],
          placement === 'line' ? ['LineString', 'MultiLineString'] : ['Point', 'MultiPoint'],
          true, false,
        ],
        layout: {
          ...visible('showWaterLabels'),
          'symbol-placement': placement,
          'text-field': name,
          'text-font': ['Noto Sans Italic'],
          'text-size': 11 * size('waterLabelSize'),
          'text-letter-spacing': 0.1,
        },
        paint: { 'text-color': color('waterLine'), 'text-halo-color': color('halo'), 'text-halo-width': halo(1) },
      }),
    ),
    {
      id: 'waterway-labels',
      type: 'symbol',
      source: OSM,
      'source-layer': 'waterway',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'river'],
      layout: {
        ...visible('showWaterLabels'),
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': ['Noto Sans Italic'],
        'text-size': 10 * size('waterLabelSize'),
        'text-letter-spacing': 0.15,
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': color('waterLine'), 'text-halo-color': color('halo'), 'text-halo-width': halo(1) },
    },
    {
      id: 'street-labels',
      type: 'symbol',
      source: OSM,
      'source-layer': 'transportation_name',
      minzoom: 12,
      filter: [
        'any',
        ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false],
        ['all', ['==', ['get', 'class'], 'minor'], ['>=', ['zoom'], 14]],
      ],
      layout: {
        ...visible('showStreetLabels'),
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 7 * size('streetLabelSize'), 16, 11 * size('streetLabelSize')],
        'text-max-angle': 30,
      },
      paint: { 'text-color': color('label'), 'text-halo-color': color('halo'), 'text-halo-width': halo(1.2) },
    },
    {
      id: 'neighbourhood-labels',
      type: 'symbol',
      source: OSM,
      'source-layer': 'place',
      minzoom: 11,
      filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet'], true, false],
      layout: {
        ...visible('showNeighbourhoodLabels'),
        'text-field': name,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], 'suburb', 10 * size('suburbLabelSize'), 8.5 * size('suburbLabelSize')],
        'text-transform': upper,
        'text-letter-spacing': 0.12,
        'text-max-width': 8,
      },
      paint: { 'text-color': color('label'), 'text-opacity': 0.8, 'text-halo-color': color('halo'), 'text-halo-width': halo(1.2) },
    },
    {
      id: 'city-labels',
      type: 'symbol',
      source: OSM,
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        ...visible('showPlaceLabels'),
        'text-field': name,
        'text-font': [String(c.placeFont)],
        'text-size': byClassOverZoom(
          [6, 12, 15],
          { city: [12, 26, 30].map((v) => v * size('cityLabelSize')) },
          [8, 14, 18].map((v) => v * size('cityLabelSize')),
          ['linear'],
        ),
        'text-transform': upper,
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: { 'text-color': color('label'), 'text-halo-color': color('halo'), 'text-halo-width': halo(1.5) },
    },
  ];

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      [OSM]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: { type: 'raster-dem', tiles: [demSource.sharedDemProtocolUrl], encoding: 'terrarium', tileSize: 256, maxzoom: 12 },
      contours: {
        type: 'vector',
        tiles: [
          demSource.contourProtocolUrl({
            thresholds: CONTOUR_THRESHOLDS[String(c.contourDensity)] ?? CONTOUR_THRESHOLDS.normal,
            contourLayer: 'contours',
            elevationKey: 'ele',
            levelKey: 'level',
            extent: 4096,
            buffer: 1,
          }),
        ],
        maxzoom: 15,
      },
    },
    layers,
  };
}
