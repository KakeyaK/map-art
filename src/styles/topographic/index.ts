import type { ArtStyle, Palette } from '../../types';
import { buildMapStyle } from './map-style';
import { drawTopographicOverlay, topographicMapRect } from './overlay';

const palettes: Palette[] = [
  {
    id: 'survey',
    name: 'Survey sheet',
    colors: {
      paper: '#f1e7d0', urban: '#efb7ab', park: '#cfe0b2', water: '#a9cfe6', waterLine: '#2c78b8',
      contour: '#b5735d', building: '#2a2321', road: '#d3242e', minorRoad: '#d9545b', rail: '#2a2321',
      label: '#2a2321', frame: '#2a2321',
    },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    colors: {
      paper: '#1c3d6b', urban: '#22497c', park: '#285487', water: '#142f57', waterLine: '#8fb3dd',
      contour: '#4f73a6', building: '#c7d7ee', road: '#eef4fb', minorRoad: '#a9c1e0', rail: '#eef4fb',
      label: '#eef4fb', frame: '#eef4fb',
    },
  },
  {
    id: 'ink',
    name: 'Ink on paper',
    colors: {
      paper: '#f7f4ec', urban: '#ebe5d8', park: '#e0e2d2', water: '#d6dcdf', waterLine: '#1d1d1d',
      contour: '#b9b1a1', building: '#1d1d1d', road: '#1d1d1d', minorRoad: '#4d4d4d', rail: '#1d1d1d',
      label: '#1d1d1d', frame: '#1d1d1d',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia atlas',
    colors: {
      paper: '#efe1c3', urban: '#e1c99c', park: '#d4cf9f', water: '#c2ccb6', waterLine: '#556556',
      contour: '#b08657', building: '#55361f', road: '#6b3c1c', minorRoad: '#8b5a31', rail: '#3c2614',
      label: '#3c2614', frame: '#3c2614',
    },
  },
  {
    id: 'night',
    name: 'Night',
    colors: {
      paper: '#101217', urban: '#1b1e26', park: '#15241b', water: '#0b2132', waterLine: '#3f86ad',
      contour: '#2d3644', building: '#323743', road: '#f1c36b', minorRoad: '#9a8256', rail: '#c9c3b4',
      label: '#e8e1cf', frame: '#e8e1cf',
    },
  },
];

export const topographic: ArtStyle = {
  id: 'topographic',
  name: 'Topographic survey',
  description: 'Vintage survey sheet: urban fill, red roads, contours, graticule and scale.',
  palettes,
  defaults: {
    title: 'SÃO PAULO',
    topLeft1: 'CARTOGRAPHIC SURVEY',
    topLeft2: 'REGIÃO SUDESTE DO BRASIL — {scale}',
    topRight1: 'SHEET SF.23-Y-C-VI-2',
    topRight2: '{lat} {lng}',
    bottomLeft: 'First edition — {year}',
    frameLanguage: 'en',
    titleFont: 'Cormorant Garamond',
    titleWeight: 500,
    titleSize: 1,
    titleSpacing: 0.06,
    margin: 1,
    palette: 'survey',
    ...palettes[0].colors,
    urbanOpacity: 0.85,
    buildingOpacity: 0.35,
    roadWidth: 1,
    labelLanguage: 'local',
    contourDensity: 'normal',
    grid: 'lines',
    showContours: true,
    showContourLabels: false,
    showHillshade: false,
    showBuildings: true,
    showParks: true,
    showRail: true,
    showStreetLabels: true,
    showPlaceLabels: true,
    showWaterLabels: true,
    showScale: true,
  },
  controls: [
    {
      title: 'Text',
      controls: [
        { type: 'text', key: 'title', label: 'Title' },
        { type: 'text', key: 'topLeft1', label: 'Top left · line 1' },
        { type: 'text', key: 'topLeft2', label: 'Top left · line 2' },
        { type: 'text', key: 'topRight1', label: 'Top right · line 1' },
        { type: 'text', key: 'topRight2', label: 'Top right · line 2' },
        { type: 'text', key: 'bottomLeft', label: 'Bottom left', hint: 'Use \\n for a new line' },
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
      title: 'Typography & frame',
      controls: [
        {
          type: 'select', key: 'titleFont', label: 'Title font',
          options: ['Cormorant Garamond', 'EB Garamond', 'Playfair Display', 'Libre Baskerville', 'Oswald', 'Josefin Sans', 'Roboto Condensed']
            .map((f) => ({ value: f, label: f })),
        },
        {
          type: 'select', key: 'titleWeight', label: 'Title weight',
          options: [
            { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' },
            { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
          ],
        },
        { type: 'range', key: 'titleSize', label: 'Title size', min: 0.4, max: 2.5, step: 0.05, unit: '×' },
        { type: 'range', key: 'titleSpacing', label: 'Title letter spacing', min: 0, max: 0.5, step: 0.01, unit: 'em' },
        { type: 'range', key: 'margin', label: 'Margin', min: 0.4, max: 2.5, step: 0.05, unit: '×' },
        {
          type: 'select', key: 'grid', label: 'Graticule',
          options: [
            { value: 'lines', label: 'Lines' }, { value: 'ticks', label: 'Crosses' }, { value: 'none', label: 'None' },
          ],
        },
        { type: 'toggle', key: 'showScale', label: 'Scale bar' },
      ],
    },
    {
      title: 'Colors',
      controls: [
        { type: 'color', key: 'paper', label: 'Paper' },
        { type: 'color', key: 'urban', label: 'Urban area' },
        { type: 'color', key: 'park', label: 'Parks & woods' },
        { type: 'color', key: 'water', label: 'Water' },
        { type: 'color', key: 'waterLine', label: 'Rivers & shores' },
        { type: 'color', key: 'contour', label: 'Contours' },
        { type: 'color', key: 'building', label: 'Buildings' },
        { type: 'color', key: 'road', label: 'Main roads' },
        { type: 'color', key: 'minorRoad', label: 'Streets' },
        { type: 'color', key: 'rail', label: 'Railways' },
        { type: 'color', key: 'label', label: 'Map labels' },
        { type: 'color', key: 'frame', label: 'Frame & text' },
      ],
    },
    {
      title: 'Map content',
      controls: [
        { type: 'range', key: 'roadWidth', label: 'Road width', min: 0.3, max: 3, step: 0.05, unit: '×' },
        { type: 'range', key: 'urbanOpacity', label: 'Urban fill', min: 0, max: 1, step: 0.05 },
        { type: 'range', key: 'buildingOpacity', label: 'Buildings', min: 0, max: 1, step: 0.05 },
        { type: 'toggle', key: 'showBuildings', label: 'Buildings' },
        { type: 'toggle', key: 'showParks', label: 'Parks & woods' },
        { type: 'toggle', key: 'showRail', label: 'Railways' },
        { type: 'toggle', key: 'showContours', label: 'Contour lines' },
        { type: 'toggle', key: 'showContourLabels', label: 'Contour elevations' },
        {
          type: 'select', key: 'contourDensity', label: 'Contour interval',
          options: [
            { value: 'coarse', label: 'Coarse' }, { value: 'normal', label: 'Normal' }, { value: 'fine', label: 'Fine' },
          ],
        },
        { type: 'toggle', key: 'showHillshade', label: 'Hillshade' },
        { type: 'toggle', key: 'showStreetLabels', label: 'Street names' },
        { type: 'toggle', key: 'showPlaceLabels', label: 'Place names' },
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
  drawOverlay: drawTopographicOverlay,
  fonts: (c) => [
    `${c.titleWeight} 20px "${c.titleFont}"`,
    '400 20px "Roboto Condensed"',
  ],
  textForPlace: (place) => {
    // "São Paulo, …, Região Sudeste, Brasil" → "REGIÃO SUDESTE, BRASIL — {scale}"
    const region = place.label.split(',').slice(1).slice(-2).map((s) => s.trim()).join(', ');
    return {
      title: place.name.toLocaleUpperCase(),
      topLeft2: region ? `${region.toLocaleUpperCase()} — {scale}` : '{scale}',
    };
  },
};
