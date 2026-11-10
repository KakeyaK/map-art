import type { Palette, StyleConfig } from '../../types';

/** Colour keys every theme defines (some derived when a theme leaves them out). */
export const COLOR_KEYS = [
  'paper', 'sheet', 'urban', 'park', 'water', 'waterLine', 'contour', 'building',
  'motorway', 'road', 'minorRoad', 'rail', 'label', 'halo', 'frame', 'titleColor', 'gridColor',
] as const;

/** Non-colour settings that are part of a theme's look. */
export const LOOK_DEFAULTS: StyleConfig = {
  urbanOpacity: 0.85,
  parkOpacity: 0.9,
  buildingOpacity: 0.35,
  contourOpacity: 1,
  motorwayCasing: true,
  titleFont: 'Cormorant Garamond',
  titleWeight: 500,
  textFont: 'Roboto Condensed',
  placeFont: 'Noto Sans Bold',
  placeUppercase: true,
  outerBorder: 'none',
};

export const THEME_KEYS = [...COLOR_KEYS, ...Object.keys(LOOK_DEFAULTS)];

type ThemeInput = Partial<StyleConfig> & {
  paper: string; urban: string; park: string; water: string; waterLine: string; contour: string;
  building: string; road: string; minorRoad: string; rail: string; label: string; frame: string;
};

/** Fills derived colours and look defaults so every theme sets every theme key. */
export function completeTheme(t: Partial<StyleConfig>): StyleConfig {
  const v = { ...LOOK_DEFAULTS, ...t } as StyleConfig;
  v.sheet ??= v.paper;
  v.halo ??= v.paper;
  v.motorway ??= v.road;
  v.titleColor ??= v.frame;
  v.gridColor ??= v.frame;
  return v;
}

const theme = (id: string, name: string, values: ThemeInput): Palette => ({ id, name, values: completeTheme(values) });

export const THEMES: Palette[] = [
  theme('survey', 'Survey sheet', {
    paper: '#f1e7d0', urban: '#efb7ab', park: '#cfe0b2', water: '#a9cfe6', waterLine: '#2c78b8',
    contour: '#b5735d', building: '#2a2321', road: '#d3242e', minorRoad: '#d9545b', rail: '#2a2321',
    label: '#2a2321', frame: '#2a2321',
  }),
  theme('swiss', 'Alpine topo', {
    paper: '#f6f5f0', urban: '#dcd8d0', park: '#c9dfb4', water: '#9fcbe8', waterLine: '#1f6fae',
    contour: '#c08a4f', building: '#4a4a4a', road: '#e8b02b', minorRoad: '#8e8e8e', rail: '#333333',
    label: '#222222', frame: '#222222', motorway: '#e0563a', titleFont: 'Roboto Condensed', titleWeight: 700,
    textFont: 'Roboto Condensed', urbanOpacity: 0.7, buildingOpacity: 0.55, outerBorder: 'thin',
  }),
  theme('blueprint', 'Blueprint', {
    paper: '#1c3d6b', urban: '#22497c', park: '#285487', water: '#142f57', waterLine: '#8fb3dd',
    contour: '#4f73a6', building: '#c7d7ee', road: '#eef4fb', minorRoad: '#a9c1e0', rail: '#eef4fb',
    label: '#eef4fb', frame: '#eef4fb', titleFont: 'Josefin Sans', titleWeight: 600,
  }),
  theme('ink', 'Ink on paper', {
    paper: '#f7f4ec', urban: '#ebe5d8', park: '#e0e2d2', water: '#d6dcdf', waterLine: '#1d1d1d',
    contour: '#b9b1a1', building: '#1d1d1d', road: '#1d1d1d', minorRoad: '#4d4d4d', rail: '#1d1d1d',
    label: '#1d1d1d', frame: '#1d1d1d',
  }),
  theme('sepia', 'Sepia atlas', {
    paper: '#efe1c3', urban: '#e1c99c', park: '#d4cf9f', water: '#c2ccb6', waterLine: '#556556',
    contour: '#b08657', building: '#55361f', road: '#6b3c1c', minorRoad: '#8b5a31', rail: '#3c2614',
    label: '#3c2614', frame: '#3c2614', titleFont: 'EB Garamond', outerBorder: 'double',
  }),
  theme('nautical', 'Nautical chart', {
    paper: '#f3e9c6', sheet: '#f6efd6', urban: '#e8d79e', park: '#d9d6a0', water: '#cfe3e8', waterLine: '#2d5f7a',
    contour: '#c9a46a', building: '#5b4a33', road: '#7b3f2a', minorRoad: '#a07a5a', rail: '#3b3b3b',
    label: '#21384a', frame: '#21384a', titleFont: 'Libre Baskerville', titleWeight: 700, outerBorder: 'double',
  }),
  theme('night', 'Night', {
    paper: '#101217', urban: '#1b1e26', park: '#15241b', water: '#0b2132', waterLine: '#3f86ad',
    contour: '#2d3644', building: '#323743', road: '#f1c36b', minorRoad: '#9a8256', rail: '#c9c3b4',
    label: '#e8e1cf', frame: '#e8e1cf',
  }),
  theme('midnight-gold', 'Midnight gold', {
    paper: '#0f1b2d', urban: '#14243b', park: '#13281f', water: '#0a1422', waterLine: '#c9a45c',
    contour: '#25374f', building: '#2a3d58', road: '#d9b26a', minorRoad: '#8f7a4f', rail: '#d9b26a',
    label: '#e9d7ab', frame: '#d9b26a', titleColor: '#e9d7ab', titleFont: 'Playfair Display', titleWeight: 600,
    outerBorder: 'thin', motorwayCasing: false,
  }),
  theme('noir', 'Noir', {
    paper: '#0d0d0d', urban: '#161616', park: '#1d1d1d', water: '#262626', waterLine: '#6a6a6a',
    contour: '#2e2e2e', building: '#3a3a3a', road: '#f2f2f2', minorRoad: '#9a9a9a', rail: '#bdbdbd',
    label: '#f2f2f2', frame: '#f2f2f2', titleFont: 'Oswald', titleWeight: 500, motorwayCasing: false,
    urbanOpacity: 1,
  }),
  theme('paper-white', 'Gallery white', {
    paper: '#ffffff', urban: '#f2f2f2', park: '#eef1ea', water: '#e3e8ec', waterLine: '#b4bec6',
    contour: '#e2ddd6', building: '#d8d8d8', road: '#222222', minorRoad: '#7a7a7a', rail: '#555555',
    label: '#222222', frame: '#222222', titleFont: 'Josefin Sans', titleWeight: 400, textFont: 'Inter',
    placeUppercase: true, motorwayCasing: false, buildingOpacity: 0.6,
  }),
  theme('terracotta', 'Terracotta', {
    paper: '#f4e4d4', urban: '#eacbb1', park: '#d6d3a8', water: '#b9d1d0', waterLine: '#3f6e6c',
    contour: '#d39f7e', building: '#8a4b33', road: '#b8482b', minorRoad: '#c97b5c', rail: '#5a3324',
    label: '#4a2a1d', frame: '#4a2a1d', titleFont: 'Playfair Display', titleWeight: 500,
  }),
  theme('forest', 'Forest', {
    paper: '#eef0e2', urban: '#dfe3cb', park: '#a9c78f', water: '#9ec4c9', waterLine: '#2f6264',
    contour: '#8fa173', building: '#3d4b33', road: '#5a3e24', minorRoad: '#7d6a4e', rail: '#2b3324',
    label: '#22301e', frame: '#22301e', titleFont: 'EB Garamond', titleWeight: 600, parkOpacity: 1,
  }),
  theme('desert', 'Desert', {
    paper: '#f3dfbf', urban: '#e7c595', park: '#cdc58e', water: '#8fc2c2', waterLine: '#2c6f73',
    contour: '#c8935d', building: '#7c4a2a', road: '#a8402a', minorRoad: '#c0825a', rail: '#5a3420',
    label: '#4b2a17', frame: '#4b2a17', titleFont: 'Oswald', titleWeight: 400,
  }),
  theme('arctic', 'Arctic', {
    paper: '#eef3f6', urban: '#dde6ec', park: '#d5e3dc', water: '#bcd5e6', waterLine: '#4b7fa6',
    contour: '#b6c7d4', building: '#6a8293', road: '#36566e', minorRoad: '#7b93a5', rail: '#36566e',
    label: '#22394a', frame: '#22394a', titleFont: 'Josefin Sans', titleWeight: 400, textFont: 'Inter',
  }),
  theme('pastel', 'Pastel', {
    paper: '#fbf6ef', urban: '#f7dfe0', park: '#d8ecd5', water: '#cfe4f2', waterLine: '#8bb3d1',
    contour: '#ecd3c1', building: '#c9a6b4', road: '#e48c8c', minorRoad: '#e6b4a8', rail: '#9c8aa8',
    label: '#5d4d5f', frame: '#5d4d5f', titleFont: 'Playfair Display', titleWeight: 400,
  }),
  theme('riso', 'Risograph', {
    paper: '#f5f0e6', urban: '#f6c6d4', park: '#bfe0d2', water: '#a7c4ee', waterLine: '#2e5bbd',
    contour: '#f3a8bf', building: '#2e5bbd', road: '#ff4f8b', minorRoad: '#ff8fb4', rail: '#2e5bbd',
    label: '#2e5bbd', frame: '#2e5bbd', titleColor: '#ff4f8b', titleFont: 'Oswald', titleWeight: 600,
    motorwayCasing: false,
  }),
  theme('japan', 'Washi', {
    paper: '#f2ebdc', urban: '#e8dcc4', park: '#d1d8b6', water: '#c5d4d8', waterLine: '#2c4a6b',
    contour: '#cbb99a', building: '#2c4a6b', road: '#c8402f', minorRoad: '#a58b74', rail: '#2a2a2a',
    label: '#2a2a2a', frame: '#2a2a2a', titleColor: '#c8402f', titleFont: 'Cormorant Garamond', titleWeight: 600,
    outerBorder: 'thick-thin',
  }),
  theme('olive', 'Field map', {
    paper: '#e6e2cf', urban: '#d6d0b2', park: '#b9c193', water: '#a8bdb8', waterLine: '#3d5a52',
    contour: '#a68e64', building: '#4a4a3a', road: '#5e5a2e', minorRoad: '#7e7a5a', rail: '#2e2e22',
    label: '#2e2e22', frame: '#2e2e22', titleFont: 'Roboto Condensed', titleWeight: 700, outerBorder: 'thin',
  }),
  theme('synthwave', 'Synthwave', {
    paper: '#1a1033', urban: '#24164a', park: '#1d2a44', water: '#0f0a24', waterLine: '#36e1ff',
    contour: '#3b2a6b', building: '#3a2470', road: '#ff3fa4', minorRoad: '#8f4bd8', rail: '#36e1ff',
    label: '#f4e9ff', frame: '#ff3fa4', titleColor: '#36e1ff', titleFont: 'Oswald', titleWeight: 500,
    motorwayCasing: false, urbanOpacity: 1,
  }),
  theme('mono-blue', 'Indigo', {
    paper: '#f3f5fa', urban: '#e1e6f2', park: '#d7deef', water: '#b8c4e2', waterLine: '#26357a',
    contour: '#c3cbe3', building: '#26357a', road: '#26357a', minorRoad: '#6a77b0', rail: '#26357a',
    label: '#1a2456', frame: '#1a2456', titleFont: 'Libre Baskerville', titleWeight: 400, motorwayCasing: false,
  }),
];
