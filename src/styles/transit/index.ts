import { frameControls, FRAME_DEFAULTS } from '../../frame/controls';
import { drawFrame, frameMapRect } from '../../frame/frame';
import type { ArtStyle, StyleConfig } from '../../types';
import { transitData, transitLegend } from './data';
import { buildTransitStyle } from './map-style';
import { TRANSIT_THEME_KEYS, TRANSIT_THEMES } from './themes';

const defaults: StyleConfig = {
  ...FRAME_DEFAULTS,
  title: 'SÃO PAULO',
  subtitle: 'METRÔ · TRENS METROPOLITANOS · MONOTRILHO',
  note1: '',
  note2: '',
  note3: '',
  titlePos: 'top-left',
  titleSize: 1.3,
  titleSpacing: 0.04,
  subtitlePos: 'top-left',
  subtitleSize: 0.9,
  legendPos: 'bottom-left',
  legendColumns: 3,
  legendSize: 0.9,
  scalePos: 'bottom-right',
  scaleStyle: 'bar',
  attribPos: 'bottom-right',
  grid: 'none',
  neatline: 0,
  margin: 1,
  palette: 'metro',
  ...TRANSIT_THEMES[0].values,
  // Which transport
  showSubway: true,
  showMonorail: true,
  showTrain: true,
  showTram: true,
  showFerry: true,
  showBus: false,
  // Lines
  lineWidth: 1,
  casingWidth: 1,
  separateShared: true,
  trainStyle: 'solid',
  busWidth: 1,
  busOpacity: 0.45,
  showLineLabels: false,
  lineLabelSize: 1,
  legendLabel: 'name',
  busLegendLabel: 'Bus routes',
  // Stations
  stationStyle: 'ring',
  stationSize: 1,
  showStationLabels: true,
  stationLabelSize: 1,
  stationLabelMinZoom: 11,
  stationUppercase: false,
  // Background map
  showPlaceLabels: false,
  labelSizing: 'paper',
  labelScale: 1,
};

export const transit: ArtStyle = {
  id: 'transit',
  name: 'Public transport',
  description:
    'Metro, train, tram, ferry and bus lines from OpenStreetMap in their official colours, over a quiet city map or on their own.',
  palettes: TRANSIT_THEMES,
  themeKeys: TRANSIT_THEME_KEYS,
  swatchKeys: ['paper', 'water', 'road', 'label', 'frame'],
  defaults,
  data: transitData,
  controls: [
    {
      title: 'Transport',
      controls: [
        { type: 'toggle', key: 'showSubway', label: 'Metro / subway' },
        { type: 'toggle', key: 'showMonorail', label: 'Monorail & light rail' },
        { type: 'toggle', key: 'showTrain', label: 'Suburban & regional trains' },
        { type: 'toggle', key: 'showTram', label: 'Trams' },
        { type: 'toggle', key: 'showFerry', label: 'Ferries' },
        {
          type: 'toggle', key: 'showBus', label: 'Buses',
          hint: 'Big cities have thousands of bus routes, so they load only when zoomed in to a neighbourhood.',
        },
        {
          type: 'select', key: 'base', label: 'Background map',
          options: [
            { value: 'city', label: 'City (streets, water, parks)' },
            { value: 'minimal', label: 'Minimal (water and parks)' },
            { value: 'none', label: 'None — transport lines only' },
          ],
        },
        {
          type: 'presets', label: 'Quick views',
          presets: [
            { label: 'Metro only', values: { showSubway: true, showMonorail: true, showTrain: false, showTram: false, showFerry: false, showBus: false, base: 'none' } },
            { label: 'Rail network', values: { showSubway: true, showMonorail: true, showTrain: true, showTram: true, showFerry: false, showBus: false } },
            { label: 'Everything', values: { showSubway: true, showMonorail: true, showTrain: true, showTram: true, showFerry: true, showBus: true } },
          ],
        },
        {
          type: 'heading', label: 'Lines',
        },
        {
          type: 'select', key: 'lineColors', label: 'Line colours',
          options: [
            { value: 'official', label: 'Official colours' },
            { value: 'mono', label: 'One colour' },
          ],
        },
        { type: 'color', key: 'monoColor', label: 'Single line colour' },
        { type: 'range', key: 'lineWidth', label: 'Line width', min: 0.3, max: 4, step: 0.05, unit: '×' },
        { type: 'range', key: 'casingWidth', label: 'Outline around lines', min: 0, max: 3, step: 0.1, unit: '×' },
        { type: 'toggle', key: 'separateShared', label: 'Draw lines sharing track side by side' },
        {
          type: 'select', key: 'trainStyle', label: 'Train lines',
          options: [{ value: 'solid', label: 'Solid' }, { value: 'striped', label: 'Striped centre' }],
        },
        { type: 'toggle', key: 'showLineLabels', label: 'Line numbers along the lines' },
        { type: 'range', key: 'lineLabelSize', label: 'Line number size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'busWidth', label: 'Bus line width', min: 0.3, max: 4, step: 0.05, unit: '×' },
        { type: 'range', key: 'busOpacity', label: 'Bus line opacity', min: 0.05, max: 1, step: 0.05 },
        { type: 'heading', label: 'Stations' },
        {
          type: 'select', key: 'stationStyle', label: 'Station marks',
          options: [
            { value: 'ring', label: 'White with coloured ring' },
            { value: 'dot', label: 'Coloured dot' },
            { value: 'none', label: 'None' },
          ],
        },
        { type: 'range', key: 'stationSize', label: 'Station size', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'showStationLabels', label: 'Station names' },
        { type: 'range', key: 'stationLabelSize', label: 'Station name size', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'stationLabelMinZoom', label: 'Show names from zoom', min: 8, max: 15, step: 0.5 },
        { type: 'toggle', key: 'stationUppercase', label: 'Station names in capitals' },
        { type: 'heading', label: 'Labels' },
        {
          type: 'select', key: 'labelSizing', label: 'Label size follows',
          options: [
            { value: 'paper', label: 'The paper size' },
            { value: 'fixed', label: 'Nothing (same physical size)' },
          ],
        },
        { type: 'range', key: 'labelScale', label: 'All map labels', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'showPlaceLabels', label: 'Neighbourhood names (background map)' },
        {
          type: 'select', key: 'legendLabel', label: 'Legend shows',
          options: [{ value: 'name', label: 'Line names' }, { value: 'ref', label: 'Line numbers' }],
          hint: 'Lines and stations: © OpenStreetMap contributors, via the Overpass API. Coverage depends on the city.',
        },
      ],
    },
    ...frameControls({ legend: true }),
    {
      title: 'Colours',
      controls: [
        { type: 'color', key: 'paper', label: 'Map background' },
        { type: 'color', key: 'sheet', label: 'Border (sheet)' },
        { type: 'color', key: 'water', label: 'Water' },
        { type: 'color', key: 'park', label: 'Parks' },
        { type: 'color', key: 'road', label: 'Streets' },
        { type: 'range', key: 'roadOpacity', label: 'Street opacity', min: 0, max: 1, step: 0.05 },
        { type: 'range', key: 'parkOpacity', label: 'Park opacity', min: 0, max: 1, step: 0.05 },
        { type: 'color', key: 'casing', label: 'Line outline' },
        { type: 'color', key: 'stationFill', label: 'Station fill' },
        { type: 'color', key: 'stationStroke', label: 'Interchange ring' },
        { type: 'color', key: 'busColor', label: 'Buses' },
        { type: 'color', key: 'ferryColor', label: 'Ferries' },
        { type: 'color', key: 'label', label: 'Station names' },
        { type: 'color', key: 'halo', label: 'Label halo' },
      ],
    },
  ],
  mapRect: (c, paper) => frameMapRect(c, paper, { legend: transitLegend(c) }),
  mapStyle: buildTransitStyle,
  sheetColor: (c) => String(c.sheet),
  drawOverlay: (ctx, scene, c) => drawFrame(ctx, scene, c, { legend: transitLegend(c) }),
  fonts: (c) => [
    `${c.titleWeight} 20px "${c.titleFont}"`,
    `400 20px "${c.textFont}"`,
    `600 20px "${c.textFont}"`,
    `700 20px "${c.textFont}"`,
  ],
  textForPlace: (place) => ({ title: place.name.toLocaleUpperCase() }),
};
