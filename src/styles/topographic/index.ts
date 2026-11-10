import type { ArtStyle, Control, StyleConfig } from '../../types';
import { buildMapStyle } from './map-style';
import { drawTopographicOverlay, elementFont, TEXT_ELEMENTS, topographicMapRect } from './overlay';
import { migrate } from './migrate';
import { THEME_KEYS, THEMES } from './themes';

/** Fonts loaded in index.html (keep the two lists in sync). */
const FONTS = [
  'Cormorant Garamond', 'EB Garamond', 'Playfair Display', 'Libre Baskerville', 'Lora', 'DM Serif Display',
  'Oswald', 'Bebas Neue', 'Josefin Sans', 'Montserrat', 'Roboto Condensed', 'Inter', 'Space Mono',
];
const fontOptions = FONTS.map((f) => ({ value: f, label: f }));
const WEIGHTS = [
  { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
];
/** Typeface for one text element; empty means "use the theme's". */
const fontControls = (id: string): Control[] => [
  { type: 'select', key: `${id}FontFace`, label: 'Font', options: [{ value: '', label: 'From the theme' }, ...fontOptions] },
  { type: 'select', key: `${id}FontWeight`, label: 'Weight', options: [{ value: '', label: 'From the theme' }, ...WEIGHTS] },
];
const size = (key: string, min = 0.4, max = 3): Control => ({ type: 'range', key, label: 'Size', min, max, step: 0.05, unit: '×' });
const TOKENS_HINT = 'Tokens: {scale} {lat} {lng} {zoom} {year} {date}';

/** Where each element sits by default, as fractions of the sheet (see `FrameElement`). */
const PLACEMENT: StyleConfig = {
  titleX: 0.5, titleY: 0.029, titleAlign: 'center', titleShow: true,
  note1X: 0.045, note1Y: 0.031, note1Align: 'left', note1Show: true,
  subtitleX: 0.045, subtitleY: 0.045, subtitleAlign: 'left', subtitleShow: true,
  note2X: 0.955, note2Y: 0.036, note2Align: 'right', note2Show: true,
  note3X: 0.045, note3Y: 0.944, note3Align: 'left', note3Show: true,
  scaleX: 0.5, scaleY: 0.944, scaleAlign: 'center', scaleShow: true,
  northX: 0.93, northY: 0.09, northAlign: 'center', northShow: false,
  attribX: 0.955, attribY: 0.944, attribAlign: 'right', attribShow: true,
};

const defaults: StyleConfig = {
  // Elements
  title: 'SÃO PAULO',
  subtitle: 'REGIÃO SUDESTE DO BRASIL — {scale}',
  note1: 'CARTOGRAPHIC SURVEY',
  note2: 'SHEET SF.23-Y-C-VI-2\n{lat} {lng}',
  note3: 'First edition — {year}',
  ...PLACEMENT,
  // Per-element typeface; empty follows the theme.
  ...Object.fromEntries(TEXT_ELEMENTS.flatMap((id) => [[`${id}FontFace`, ''], [`${id}FontWeight`, '']])),
  titleSize: 1,
  titleSpacing: 0.06,
  subtitleSize: 1,
  note1Size: 0.8,
  note2Size: 0.9,
  note3Size: 0.8,
  scaleStyle: 'both',
  scaleSize: 1,
  frameLanguage: 'en',
  northStyle: 'arrow',
  northSize: 1,
  attribSize: 1,
  // Layout
  margin: 1,
  marginTop: 1,
  marginBottom: 1,
  grid: 'lines',
  insetBox: 'box',
  // Theme
  palette: 'survey',
  ...THEMES[0].values,
  // Map
  roadWidth: 1,
  contourDensity: 'normal',
  showContours: true,
  showContourLabels: false,
  showHillshade: false,
  showBuildings: true,
  showParks: true,
  showRail: true,
  // Map labels
  labelScale: 1,
  labelLanguage: 'local',
  showPlaceLabels: true,
  showNeighbourhoodLabels: true,
  showStreetLabels: true,
  showWaterLabels: true,
};

export const topographic: ArtStyle = {
  id: 'topographic',
  name: 'Topographic survey',
  description: 'Survey-sheet map: urban fill, roads, contours, graticule and scale.',
  palettes: THEMES,
  themeKeys: THEME_KEYS,
  swatchKeys: ['sheet', 'urban', 'road', 'water', 'frame'],
  themeControls: [
    { type: 'heading', label: 'Colours' },
    { type: 'color', key: 'paper', label: 'Map background' },
    { type: 'color', key: 'sheet', label: 'Sheet' },
    { type: 'color', key: 'urban', label: 'Urban area' },
    { type: 'color', key: 'park', label: 'Parks & woods' },
    { type: 'color', key: 'water', label: 'Water' },
    { type: 'color', key: 'waterLine', label: 'Rivers & shores' },
    { type: 'color', key: 'contour', label: 'Contours' },
    { type: 'color', key: 'building', label: 'Buildings' },
    { type: 'color', key: 'motorway', label: 'Motorways' },
    { type: 'color', key: 'road', label: 'Main roads' },
    { type: 'color', key: 'minorRoad', label: 'Streets' },
    { type: 'color', key: 'rail', label: 'Railways' },
    { type: 'color', key: 'label', label: 'Map labels' },
    { type: 'color', key: 'halo', label: 'Label halo' },
    { type: 'color', key: 'frame', label: 'Frame & text' },
    { type: 'color', key: 'titleColor', label: 'Title' },
    { type: 'color', key: 'gridColor', label: 'Graticule' },
    { type: 'heading', label: 'Type' },
    { type: 'select', key: 'titleFont', label: 'Title font', options: fontOptions },
    { type: 'select', key: 'titleWeight', label: 'Title weight', options: WEIGHTS },
    { type: 'select', key: 'textFont', label: 'Notes & scale font', options: fontOptions },
    {
      type: 'select', key: 'placeFont', label: 'City names on the map',
      options: [
        { value: 'Noto Sans Bold', label: 'Sans bold' }, { value: 'Noto Sans Regular', label: 'Sans regular' },
        { value: 'Noto Sans Italic', label: 'Sans italic' },
      ],
    },
    { type: 'toggle', key: 'placeUppercase', label: 'Place names in capitals' },
    { type: 'heading', label: 'Fills' },
    { type: 'range', key: 'urbanOpacity', label: 'Urban fill', min: 0, max: 1, step: 0.05 },
    { type: 'range', key: 'parkOpacity', label: 'Parks fill', min: 0, max: 1, step: 0.05 },
    { type: 'range', key: 'buildingOpacity', label: 'Buildings fill', min: 0, max: 1, step: 0.05 },
    { type: 'range', key: 'contourOpacity', label: 'Contours', min: 0.05, max: 1.1, step: 0.05 },
    { type: 'toggle', key: 'motorwayCasing', label: 'Hollow motorways (double line)' },
    {
      type: 'select', key: 'outerBorder', label: 'Sheet border',
      options: [
        { value: 'none', label: 'None' }, { value: 'thin', label: 'Thin line' },
        { value: 'double', label: 'Double line' }, { value: 'thick-thin', label: 'Thick + thin' },
      ],
    },
  ],
  defaults,
  migrate,
  elements: [
    {
      id: 'title', label: 'Title', textKey: 'title', canHide: true,
      controls: [
        ...fontControls('title'),
        size('titleSize', 0.3),
        { type: 'range', key: 'titleSpacing', label: 'Letter spacing', min: 0, max: 0.6, step: 0.01, unit: 'em' },
      ],
    },
    { id: 'subtitle', label: 'Subtitle', textKey: 'subtitle', textHint: TOKENS_HINT, canHide: true, controls: [...fontControls('subtitle'), size('subtitleSize')] },
    { id: 'note1', label: 'Note A', textKey: 'note1', textHint: TOKENS_HINT, canHide: true, controls: [...fontControls('note1'), size('note1Size')] },
    { id: 'note2', label: 'Note B', textKey: 'note2', textHint: TOKENS_HINT, canHide: true, controls: [...fontControls('note2'), size('note2Size')] },
    { id: 'note3', label: 'Note C', textKey: 'note3', textHint: TOKENS_HINT, canHide: true, controls: [...fontControls('note3'), size('note3Size')] },
    {
      id: 'scale', label: 'Scale', canHide: true,
      controls: [
        {
          type: 'select', key: 'scaleStyle', label: 'Show',
          options: [{ value: 'both', label: 'Bar and 1:N' }, { value: 'bar', label: 'Bar only' }, { value: 'text', label: '1:N only' }],
        },
        {
          type: 'select', key: 'frameLanguage', label: 'Caption language',
          options: [
            { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' },
            { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' },
          ],
        },
        size('scaleSize'),
      ],
    },
    {
      id: 'north', label: 'North arrow', canHide: true,
      controls: [
        {
          type: 'select', key: 'northStyle', label: 'Style',
          options: [{ value: 'arrow', label: 'Arrow' }, { value: 'compass', label: 'Compass star' }, { value: 'line', label: 'Line' }],
        },
        size('northSize'),
      ],
    },
    {
      id: 'attrib', label: 'Map credits', canHide: false,
      textHint: 'The OpenStreetMap licence requires this credit on the print, so it can move but not be hidden.',
      controls: [size('attribSize', 0.5, 2)],
    },
  ],
  controls: [
    {
      title: 'Layout',
      controls: [
        { type: 'range', key: 'marginTop', label: 'Top margin', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'marginBottom', label: 'Bottom margin', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'margin', label: 'Side margins', min: 0, max: 3, step: 0.05, unit: '×',
          hint: 'At 0 the map reaches the edge of the sheet.' },
        {
          type: 'select', key: 'grid', label: 'Graticule',
          options: [
            { value: 'lines', label: 'Lines' }, { value: 'ticks', label: 'Crosses' },
            { value: 'border', label: 'Edge ticks only' }, { value: 'none', label: 'None' },
          ],
        },
        {
          type: 'select', key: 'insetBox', label: 'Text over the map',
          options: [
            { value: 'box', label: 'On a box' }, { value: 'box-border', label: 'On an outlined box' }, { value: 'none', label: 'Directly on the map' },
          ],
        },
      ],
    },
    {
      title: 'Map content',
      controls: [
        { type: 'range', key: 'roadWidth', label: 'Road width', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'showBuildings', label: 'Buildings' },
        { type: 'toggle', key: 'showParks', label: 'Parks & woods' },
        { type: 'toggle', key: 'showRail', label: 'Railways' },
        { type: 'toggle', key: 'showContours', label: 'Contour lines' },
        { type: 'toggle', key: 'showContourLabels', label: 'Contour elevations' },
        {
          type: 'select', key: 'contourDensity', label: 'Contour interval',
          options: [{ value: 'coarse', label: 'Coarse' }, { value: 'normal', label: 'Normal' }, { value: 'fine', label: 'Fine' }],
        },
        { type: 'toggle', key: 'showHillshade', label: 'Hillshade' },
      ],
    },
    {
      title: 'Map labels',
      controls: [
        { type: 'range', key: 'labelScale', label: 'Label size', min: 0.3, max: 2.5, step: 0.05, unit: '×',
          hint: 'Labels already shrink on small sheets; this adjusts them further.' },
        { type: 'toggle', key: 'showPlaceLabels', label: 'City & town names' },
        { type: 'toggle', key: 'showNeighbourhoodLabels', label: 'Neighbourhood names' },
        { type: 'toggle', key: 'showStreetLabels', label: 'Street names' },
        { type: 'toggle', key: 'showWaterLabels', label: 'Water names' },
        {
          type: 'select', key: 'labelLanguage', label: 'Label language',
          options: [
            { value: 'local', label: 'Local' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' },
            { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' },
          ],
        },
      ],
    },
  ],
  mapRect: topographicMapRect,
  mapStyle: buildMapStyle,
  sheetColor: (c) => String(c.sheet ?? c.paper),
  drawOverlay: drawTopographicOverlay,
  fonts: (c) => [
    `400 20px "${c.textFont}"`,
    `600 20px "${c.textFont}"`,
    ...TEXT_ELEMENTS.map((id) => {
      const f = elementFont(c, id);
      return `${f.weight} 20px "${f.name}"`;
    }),
  ],
  textForPlace: (place) => {
    // "São Paulo, …, Região Sudeste, Brasil" → "REGIÃO SUDESTE, BRASIL — {scale}"
    const region = place.label.split(',').slice(1).slice(-2).map((s) => s.trim()).join(', ');
    return {
      title: place.name.toLocaleUpperCase(),
      subtitle: region ? `${region.toLocaleUpperCase()} — {scale}` : '{scale}',
    };
  },
};
