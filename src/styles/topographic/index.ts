import { frameControls, FRAME_DEFAULTS } from '../../frame/controls';
import { drawFrame, frameMapRect } from '../../frame/frame';
import type { ArtStyle, StyleConfig } from '../../types';
import { buildMapStyle } from './map-style';
import { migrate } from './migrate';
import { THEME_KEYS, THEMES } from './themes';

const LABEL_SIZE_PRESETS: { label: string; values: StyleConfig }[] = [
  { label: 'Smaller', values: { labelScale: 0.7 } },
  { label: 'Default', values: { labelScale: 1, cityLabelSize: 1, suburbLabelSize: 1, streetLabelSize: 1, waterLabelSize: 1, contourLabelSize: 1 } },
  { label: 'Larger', values: { labelScale: 1.3 } },
];

const defaults: StyleConfig = {
  ...FRAME_DEFAULTS,
  // Theme
  palette: 'survey',
  ...THEMES[0].values,
  // Map
  roadWidth: 1,
  contourWidth: 1,
  waterLineWidth: 1,
  hillshadeStrength: 1,
  hillshadeShadow: '#000000',
  labelLanguage: 'local',
  contourDensity: 'normal',
  showContours: true,
  showContourLabels: false,
  showHillshade: false,
  showBuildings: true,
  showParks: true,
  showRail: true,
  showStreetLabels: true,
  showPlaceLabels: true,
  showNeighbourhoodLabels: true,
  showWaterLabels: true,
  // Map labels
  labelSizing: 'paper',
  labelScale: 1,
  cityLabelSize: 1,
  suburbLabelSize: 1,
  streetLabelSize: 1,
  waterLabelSize: 1,
  contourLabelSize: 1,
  haloWidth: 1,
};

export const topographic: ArtStyle = {
  id: 'topographic',
  name: 'Topographic survey',
  description: 'Survey-sheet map: urban fill, roads, contours, graticule and scale. Every frame element can be moved or hidden.',
  palettes: THEMES,
  themeKeys: THEME_KEYS,
  swatchKeys: ['sheet', 'urban', 'road', 'water', 'frame'],
  defaults,
  migrate,
  controls: [
    ...frameControls(),
    {
      title: 'Map labels',
      controls: [
        {
          type: 'select', key: 'labelSizing', label: 'Label size follows',
          options: [
            { value: 'paper', label: 'The paper size (smaller sheet → smaller labels)' },
            { value: 'fixed', label: 'Nothing (same physical size on any sheet)' },
          ],
          hint: 'Map labels are printed at a real size in mm. On A5/A6 the fixed mode makes them look big next to the map.',
        },
        { type: 'presets', label: 'Quick sizes', presets: LABEL_SIZE_PRESETS },
        { type: 'range', key: 'labelScale', label: 'All labels', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'cityLabelSize', label: 'City & town names', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'suburbLabelSize', label: 'Neighbourhood names', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'streetLabelSize', label: 'Street names', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'waterLabelSize', label: 'Water names', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'contourLabelSize', label: 'Contour elevations', min: 0.2, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'showPlaceLabels', label: 'City & town names' },
        { type: 'toggle', key: 'showNeighbourhoodLabels', label: 'Neighbourhood names' },
        { type: 'toggle', key: 'showStreetLabels', label: 'Street names' },
        { type: 'toggle', key: 'showWaterLabels', label: 'Water names' },
        { type: 'toggle', key: 'showContourLabels', label: 'Contour elevations' },
        {
          type: 'select', key: 'placeFont', label: 'City name font',
          options: [
            { value: 'Noto Sans Bold', label: 'Sans bold' }, { value: 'Noto Sans Regular', label: 'Sans regular' },
            { value: 'Noto Sans Italic', label: 'Sans italic' },
          ],
        },
        { type: 'toggle', key: 'placeUppercase', label: 'Place names in capitals' },
        { type: 'range', key: 'haloWidth', label: 'Halo around labels', min: 0, max: 3, step: 0.05, unit: '×' },
        {
          type: 'select', key: 'labelLanguage', label: 'Label language',
          options: [
            { value: 'local', label: 'Local' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' },
            { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' },
          ],
        },
      ],
    },
    {
      title: 'Colours',
      controls: [
        { type: 'color', key: 'paper', label: 'Map background' },
        { type: 'color', key: 'sheet', label: 'Border (sheet)' },
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
        { type: 'color', key: 'hillshadeShadow', label: 'Hillshade shadow' },
      ],
    },
    {
      title: 'Map content',
      controls: [
        { type: 'range', key: 'roadWidth', label: 'Road width', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'motorwayCasing', label: 'Hollow motorways (double line)' },
        { type: 'range', key: 'urbanOpacity', label: 'Urban fill', min: 0, max: 1, step: 0.05 },
        { type: 'range', key: 'parkOpacity', label: 'Parks fill', min: 0, max: 1, step: 0.05 },
        { type: 'range', key: 'buildingOpacity', label: 'Buildings fill', min: 0, max: 1, step: 0.05 },
        { type: 'range', key: 'waterLineWidth', label: 'Shoreline width', min: 0, max: 3, step: 0.05, unit: '×' },
        { type: 'toggle', key: 'showBuildings', label: 'Buildings' },
        { type: 'toggle', key: 'showParks', label: 'Parks & woods' },
        { type: 'toggle', key: 'showRail', label: 'Railways' },
        { type: 'toggle', key: 'showContours', label: 'Contour lines' },
        {
          type: 'select', key: 'contourDensity', label: 'Contour interval',
          options: [
            { value: 'coarse', label: 'Coarse' }, { value: 'normal', label: 'Normal' }, { value: 'fine', label: 'Fine' },
          ],
        },
        { type: 'range', key: 'contourWidth', label: 'Contour width', min: 0.2, max: 4, step: 0.05, unit: '×' },
        { type: 'range', key: 'contourOpacity', label: 'Contour opacity', min: 0.05, max: 1.1, step: 0.05 },
        { type: 'toggle', key: 'showHillshade', label: 'Hillshade' },
        { type: 'range', key: 'hillshadeStrength', label: 'Hillshade strength', min: 0.2, max: 2.8, step: 0.1, unit: '×' },
      ],
    },
  ],
  mapRect: (c, paper) => frameMapRect(c, paper),
  mapStyle: buildMapStyle,
  sheetColor: (c) => String(c.sheet ?? c.paper),
  drawOverlay: (ctx, scene, c) => drawFrame(ctx, scene, c),
  fonts: (c) => [
    `${c.titleWeight} 20px "${c.titleFont}"`,
    `400 20px "${c.textFont}"`,
    `600 20px "${c.textFont}"`,
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
