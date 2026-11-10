import type { Control, ControlGroup, StyleConfig } from '../types';
import { SLOT_OPTIONS } from './frame';

/*
 * Settings and sidebar controls for the frame around the map (texts, borders,
 * graticule, scale...). Shared by every art style that draws with `drawFrame`.
 */

export const FONTS = ['Cormorant Garamond', 'EB Garamond', 'Playfair Display', 'Libre Baskerville', 'Oswald', 'Josefin Sans', 'Roboto Condensed', 'Inter'];
const fontOptions = FONTS.map((f) => ({ value: f, label: f }));
const position = (key: string, label = 'Position'): Control => ({ type: 'select', key, label, options: SLOT_OPTIONS });

/** Frame layouts: where things go, not what they say. */
export const FRAME_LAYOUTS: { label: string; values: StyleConfig }[] = [
  {
    label: 'Classic survey',
    values: {
      titlePos: 'top-center', note1Pos: 'top-left', subtitlePos: 'top-left', note2Pos: 'top-right',
      note3Pos: 'bottom-left', scalePos: 'bottom-center', northPos: 'hidden', attribPos: 'bottom-right',
      margin: 1, marginTop: 1, marginRight: 1, marginBottom: 1, marginLeft: 1,
      grid: 'lines', gridLabelsTop: true, gridLabelsRight: true, gridLabelsBottom: true, gridLabelsLeft: true,
      neatline: 1,
    },
  },
  {
    label: 'Minimal poster',
    values: {
      titlePos: 'bottom-center', note1Pos: 'hidden', subtitlePos: 'bottom-center', note2Pos: 'hidden',
      note3Pos: 'hidden', scalePos: 'hidden', northPos: 'hidden', attribPos: 'bottom-right',
      margin: 1, marginTop: 1, marginRight: 1, marginBottom: 1, marginLeft: 1,
      grid: 'none', neatline: 0.6,
    },
  },
  {
    label: 'Bottom band only',
    values: {
      titlePos: 'bottom-left', note1Pos: 'hidden', subtitlePos: 'bottom-left', note2Pos: 'bottom-right',
      note3Pos: 'hidden', scalePos: 'bottom-right', northPos: 'hidden', attribPos: 'map-bottom-right',
      margin: 1, marginTop: 0, marginRight: 0, marginBottom: 1, marginLeft: 0,
      grid: 'none', neatline: 0,
    },
  },
  {
    label: 'Full bleed',
    values: {
      titlePos: 'map-bottom-center', note1Pos: 'hidden', subtitlePos: 'map-bottom-center', note2Pos: 'hidden',
      note3Pos: 'hidden', scalePos: 'map-bottom-left', northPos: 'map-top-right', attribPos: 'map-bottom-right',
      margin: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
      grid: 'none', neatline: 0, insetBox: 'box', outerBorder: 'none',
    },
  },
  {
    label: 'Framed atlas',
    values: {
      titlePos: 'top-center', note1Pos: 'hidden', subtitlePos: 'top-center', note2Pos: 'hidden',
      note3Pos: 'bottom-left', scalePos: 'bottom-center', northPos: 'bottom-right', attribPos: 'map-bottom-right',
      margin: 1.3, marginTop: 1, marginRight: 1, marginBottom: 1, marginLeft: 1,
      grid: 'border', gridLabelsTop: true, gridLabelsRight: true, gridLabelsBottom: true, gridLabelsLeft: true,
      neatline: 1.5, outerBorder: 'double',
    },
  },
];


export const FRAME_DEFAULTS: StyleConfig = {
  // Text
  title: 'SÃO PAULO',
  note1: 'CARTOGRAPHIC SURVEY',
  subtitle: 'REGIÃO SUDESTE DO BRASIL — {scale}',
  note2: 'SHEET SF.23-Y-C-VI-2\n{lat} {lng}',
  note3: 'First edition — {year}',
  frameLanguage: 'en',
  // Frame elements
  titlePos: 'top-center',
  titleSize: 1,
  titleSpacing: 0.06,
  note1Pos: 'top-left',
  note1Size: 0.8,
  subtitlePos: 'top-left',
  subtitleSize: 1,
  note2Pos: 'top-right',
  note2Size: 0.9,
  note3Pos: 'bottom-left',
  note3Size: 0.8,
  scalePos: 'bottom-center',
  scaleStyle: 'both',
  scaleSize: 1,
  scaleLength: 1,
  northPos: 'hidden',
  northStyle: 'arrow',
  northSize: 1,
  attribPos: 'bottom-right',
  attribSize: 1,
  // Borders
  margin: 1,
  marginTop: 1,
  marginRight: 1,
  marginBottom: 1,
  marginLeft: 1,
  neatline: 1,
  outerBorderInset: 1,
  insetBox: 'box',
  insetOpacity: 0.9,
  grid: 'lines',
  gridDensity: 1,
  gridOpacity: 0.75,
  gridWidth: 1,
  gridLabelsTop: true,
  gridLabelsRight: true,
  gridLabelsBottom: true,
  gridLabelsLeft: true,
  legendPos: 'hidden',
  legendTitle: '',
  legendSize: 1,
  legendColumns: 1,
};

export function frameControls(opts: { legend?: boolean } = {}): ControlGroup[] {
  return [
    {
      title: 'Text',
      controls: [
        { type: 'textarea', key: 'title', label: 'Title', rows: 1 },
        { type: 'textarea', key: 'subtitle', label: 'Subtitle', rows: 1 },
        { type: 'textarea', key: 'note1', label: 'Note A', rows: 2 },
        { type: 'textarea', key: 'note2', label: 'Note B', rows: 2 },
        { type: 'textarea', key: 'note3', label: 'Note C', rows: 2,
          hint: 'Empty text hides an element. Tokens: {scale} {lat} {lng} {zoom} {year} {date}' },
        {
          type: 'select', key: 'frameLanguage', label: 'Frame language',
          options: [
            { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' },
            { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' },
          ],
        },
      ],
    },
    {
      title: 'Layout & borders',
      controls: [
        { type: 'presets', label: 'Quick layouts', presets: FRAME_LAYOUTS,
          hint: 'Moves elements and sets the borders; your texts stay.' },
        { type: 'heading', label: 'Border on each side' },
        { type: 'range', key: 'margin', label: 'All borders', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'marginTop', label: 'Top', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'marginBottom', label: 'Bottom', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'marginLeft', label: 'Left', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'marginRight', label: 'Right', min: 0, max: 3, step: 0.05, unit: '×',
          hint: '0 takes the map to the edge on that side. Elements placed in a band still make room for themselves.' },
        { type: 'heading', label: 'Lines' },
        { type: 'range', key: 'neatline', label: 'Map outline', min: 0, max: 4, step: 0.1, unit: '×' },
        {
          type: 'select', key: 'outerBorder', label: 'Sheet border',
          options: [
            { value: 'none', label: 'None' }, { value: 'thin', label: 'Thin line' },
            { value: 'double', label: 'Double line' }, { value: 'thick-thin', label: 'Thick + thin' },
          ],
        },
        { type: 'range', key: 'outerBorderInset', label: 'Sheet border distance', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Boxes for elements on the map' },
        {
          type: 'select', key: 'insetBox', label: 'Background',
          options: [
            { value: 'none', label: 'None' }, { value: 'box', label: 'Box' }, { value: 'box-border', label: 'Box with outline' },
          ],
        },
        { type: 'range', key: 'insetOpacity', label: 'Box opacity', min: 0, max: 1, step: 0.05 },
      ],
    },
    {
      title: 'Frame elements',
      controls: [
        { type: 'heading', label: 'Title' },
        position('titlePos'),
        { type: 'range', key: 'titleSize', label: 'Size', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'select', key: 'titleFont', label: 'Font', options: fontOptions },
        {
          type: 'select', key: 'titleWeight', label: 'Weight',
          options: [
            { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' },
            { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
          ],
        },
        { type: 'range', key: 'titleSpacing', label: 'Letter spacing', min: 0, max: 0.6, step: 0.01, unit: 'em' },
        { type: 'heading', label: 'Subtitle' },
        position('subtitlePos'),
        { type: 'range', key: 'subtitleSize', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Note A' },
        position('note1Pos'),
        { type: 'range', key: 'note1Size', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Note B' },
        position('note2Pos'),
        { type: 'range', key: 'note2Size', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Note C' },
        position('note3Pos'),
        { type: 'range', key: 'note3Size', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        ...(opts.legend
          ? ([
              { type: 'heading', label: 'Legend' },
              position('legendPos'),
              { type: 'textarea', key: 'legendTitle', label: 'Heading', rows: 1 },
              { type: 'range', key: 'legendSize', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
              { type: 'range', key: 'legendColumns', label: 'Columns', min: 1, max: 6, step: 1 },
            ] as Control[])
          : []),
        { type: 'heading', label: 'Scale' },
        position('scalePos'),
        {
          type: 'select', key: 'scaleStyle', label: 'Show',
          options: [
            { value: 'both', label: 'Bar and 1:N' }, { value: 'bar', label: 'Bar only' }, { value: 'text', label: '1:N only' },
          ],
        },
        { type: 'range', key: 'scaleSize', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'scaleLength', label: 'Bar length', min: 0.4, max: 2.5, step: 0.05, unit: '×' },
        { type: 'heading', label: 'North arrow' },
        position('northPos'),
        {
          type: 'select', key: 'northStyle', label: 'Style',
          options: [
            { value: 'arrow', label: 'Arrow' }, { value: 'compass', label: 'Compass star' }, { value: 'line', label: 'Line' },
          ],
        },
        { type: 'range', key: 'northSize', label: 'Size', min: 0.4, max: 3, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Attribution' },
        { ...position('attribPos'), options: SLOT_OPTIONS.filter((o) => o.value !== 'hidden'),
          hint: 'The OpenStreetMap licence requires this credit on the print, so it can move but not disappear.' } as Control,
        { type: 'range', key: 'attribSize', label: 'Size', min: 0.5, max: 2, step: 0.05, unit: '×' },
        { type: 'heading', label: 'Other text' },
        { type: 'select', key: 'textFont', label: 'Font for notes, scale and grid', options: fontOptions },
        { type: 'color', key: 'titleColor', label: 'Title colour' },
        { type: 'color', key: 'frame', label: 'Frame lines & text' },
      ],
    },
    {
      title: 'Graticule',
      controls: [
        {
          type: 'select', key: 'grid', label: 'Style',
          options: [
            { value: 'lines', label: 'Lines across the map' }, { value: 'ticks', label: 'Crosses' },
            { value: 'border', label: 'Edge ticks only' }, { value: 'none', label: 'None' },
          ],
        },
        { type: 'toggle', key: 'gridLabelsTop', label: 'Coordinates on top' },
        { type: 'toggle', key: 'gridLabelsBottom', label: 'Coordinates at bottom' },
        { type: 'toggle', key: 'gridLabelsLeft', label: 'Coordinates on the left' },
        { type: 'toggle', key: 'gridLabelsRight', label: 'Coordinates on the right' },
        { type: 'range', key: 'gridDensity', label: 'Density', min: 0.4, max: 3, step: 0.1, unit: '×' },
        { type: 'range', key: 'gridWidth', label: 'Line weight', min: 0.3, max: 4, step: 0.1, unit: '×' },
        { type: 'range', key: 'gridOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.05 },
        { type: 'color', key: 'gridColor', label: 'Colour' },
      ],
    },
  ];
}
