import type { Palette, StyleConfig } from '../../types';

export const TRANSIT_COLOR_KEYS = [
  'paper', 'sheet', 'water', 'park', 'road', 'label', 'halo', 'casing', 'stationFill', 'stationStroke',
  'busColor', 'ferryColor', 'monoColor', 'frame', 'titleColor', 'gridColor',
];

const LOOK: StyleConfig = {
  base: 'city',
  lineColors: 'official',
  parkOpacity: 0.8,
  roadOpacity: 1,
  titleFont: 'Josefin Sans',
  titleWeight: 600,
  textFont: 'Inter',
  outerBorder: 'none',
};

export const TRANSIT_THEME_KEYS = [...TRANSIT_COLOR_KEYS, ...Object.keys(LOOK)];

type Input = Partial<StyleConfig> & { paper: string; water: string; park: string; road: string; label: string; frame: string };

function theme(id: string, name: string, t: Input): Palette {
  const v = { ...LOOK, ...t } as StyleConfig;
  v.sheet ??= v.paper;
  v.halo ??= v.paper;
  v.casing ??= v.paper;
  v.stationFill ??= '#ffffff';
  v.stationStroke ??= v.label;
  v.busColor ??= v.road;
  v.ferryColor ??= '#1f6fae';
  v.monoColor ??= v.label;
  v.titleColor ??= v.frame;
  v.gridColor ??= v.frame;
  return { id, name, values: v };
}

export const TRANSIT_THEMES: Palette[] = [
  theme('metro', 'Metro map', {
    paper: '#ffffff', water: '#d8e8f3', park: '#e6f0dd', road: '#e3e3e3', label: '#1d1d1b', frame: '#1d1d1b',
    busColor: '#9a9a9a',
  }),
  theme('lines-only', 'Lines only', {
    paper: '#fbfaf7', water: '#fbfaf7', park: '#fbfaf7', road: '#fbfaf7', label: '#1d1d1b', frame: '#1d1d1b',
    base: 'none', titleFont: 'Oswald', titleWeight: 500,
  }),
  theme('night-metro', 'Night metro', {
    paper: '#12151c', water: '#0c1a28', park: '#152019', road: '#222733', label: '#eceae4', frame: '#eceae4',
    stationFill: '#12151c', casing: '#12151c', busColor: '#4a5263', ferryColor: '#4fa3d9',
  }),
  theme('neon', 'Neon', {
    paper: '#05060a', water: '#05060a', park: '#05060a', road: '#05060a', label: '#f5f5f5', frame: '#f5f5f5',
    base: 'none', stationFill: '#05060a', casing: '#05060a', titleColor: '#ff3fa4', titleFont: 'Oswald', titleWeight: 500,
  }),
  theme('paper', 'Paper atlas', {
    paper: '#f4ecdb', water: '#d7e1dc', park: '#e3e4c8', road: '#e6dac2', label: '#3a2c1e', frame: '#3a2c1e',
    stationFill: '#fbf6ea', titleFont: 'Playfair Display', titleWeight: 600, textFont: 'Roboto Condensed', outerBorder: 'double',
  }),
  theme('blueprint', 'Blueprint', {
    paper: '#1c3d6b', water: '#163259', park: '#1f4675', road: '#2a5288', label: '#eef4fb', frame: '#eef4fb',
    lineColors: 'mono', monoColor: '#eef4fb', stationFill: '#1c3d6b', stationStroke: '#eef4fb', casing: '#1c3d6b',
    base: 'minimal', titleFont: 'Josefin Sans',
  }),
  theme('ink', 'Ink', {
    paper: '#ffffff', water: '#eeeeee', park: '#ffffff', road: '#ffffff', label: '#111111', frame: '#111111',
    lineColors: 'mono', monoColor: '#111111', base: 'minimal', titleFont: 'Libre Baskerville', titleWeight: 400,
  }),
  theme('pastel', 'Pastel', {
    paper: '#fbf5ee', water: '#dbe9f2', park: '#e4efdc', road: '#efe5da', label: '#4d4350', frame: '#4d4350',
    stationFill: '#fffdf9', titleFont: 'Playfair Display', titleWeight: 400,
  }),
];
