import type { StyleConfig } from '../../types';
import { completeTheme, LOOK_DEFAULTS } from './themes';

/** Elements of the slot-based frame, in its stacking order. */
const SLOTTED = ['title', 'note1', 'subtitle', 'note2', 'note3', 'scale', 'north', 'attrib'];

/** Rough sheet position of each old slot: [x, y, align]. */
const SLOT_PLACES: Record<string, [number, number, string]> = {
  'top-left': [0.045, 0.03, 'left'],
  'top-center': [0.5, 0.03, 'center'],
  'top-right': [0.955, 0.03, 'right'],
  'bottom-left': [0.045, 0.944, 'left'],
  'bottom-center': [0.5, 0.944, 'center'],
  'bottom-right': [0.955, 0.944, 'right'],
  'map-top-left': [0.08, 0.1, 'left'],
  'map-top-center': [0.5, 0.1, 'center'],
  'map-top-right': [0.92, 0.1, 'right'],
  'map-bottom-left': [0.08, 0.86, 'left'],
  'map-bottom-center': [0.5, 0.86, 'center'],
  'map-bottom-right': [0.92, 0.86, 'right'],
};

/** Settings that no longer exist. */
const REMOVED = [
  'marginLeft', 'marginRight', 'neatline', 'outerBorderInset', 'insetOpacity',
  'gridDensity', 'gridOpacity', 'gridWidth', 'gridLabelsTop', 'gridLabelsRight', 'gridLabelsBottom', 'gridLabelsLeft',
  'scaleLength', 'labelSizing', 'cityLabelSize', 'suburbLabelSize', 'streetLabelSize', 'waterLabelSize',
  'contourLabelSize', 'haloWidth', 'hillshadeStrength', 'hillshadeShadow', 'contourWidth', 'waterLineWidth',
];

/** Upgrades settings saved by older versions of the frame. */
export function migrate(saved: StyleConfig): StyleConfig {
  const s: StyleConfig = { ...saved };
  // First version: fixed corner texts.
  if ('topLeft1' in s || 'topRight1' in s || 'bottomLeft' in s) {
    if (s.topLeft1 !== undefined) s.note1 = s.topLeft1;
    if (s.topLeft2 !== undefined) s.subtitle = s.topLeft2;
    if (s.topRight1 !== undefined || s.topRight2 !== undefined) {
      s.note2 = [s.topRight1, s.topRight2].filter((v) => v !== undefined && v !== '').join('\n');
    }
    if (s.bottomLeft !== undefined) s.note3 = String(s.bottomLeft).replaceAll('\\n', '\n');
    if (s.showScale === false) s.scaleShow = false;
    if (s.showPlaceLabels === false) s.showNeighbourhoodLabels = false;
    for (const key of ['topLeft1', 'topLeft2', 'topRight1', 'topRight2', 'bottomLeft', 'showScale']) delete s[key];
  }
  // Second version: elements snapped to named slots. Elements sharing a slot are stacked.
  const stacked = new Map<string, number>();
  for (const id of SLOTTED) {
    const slot = s[`${id}Pos`];
    if (slot === undefined) continue;
    delete s[`${id}Pos`];
    s[`${id}Show`] = slot !== 'hidden';
    const place = SLOT_PLACES[String(slot)];
    if (!place) continue;
    const n = stacked.get(String(slot)) ?? 0;
    stacked.set(String(slot), n + 1);
    [s[`${id}X`], s[`${id}Y`], s[`${id}Align`]] = [place[0], place[1] + n * 0.025, place[2]];
  }
  for (const key of REMOVED) delete s[key];
  // Colours added later derive from the saved ones, so an old "Night" sheet stays dark.
  if (s.paper !== undefined && s.sheet === undefined) return completeTheme({ ...LOOK_DEFAULTS, ...s });
  return s;
}
