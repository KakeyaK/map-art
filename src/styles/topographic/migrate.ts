import type { StyleConfig } from '../../types';
import { completeTheme, LOOK_DEFAULTS } from './themes';

/** Settings from before frame elements and per-side borders existed. */
export function migrate(saved: StyleConfig): StyleConfig {
  const s: StyleConfig = { ...saved };
  if ('topLeft1' in s || 'topRight1' in s || 'bottomLeft' in s) {
    if (s.topLeft1 !== undefined) s.note1 = s.topLeft1;
    if (s.topLeft2 !== undefined) s.subtitle = s.topLeft2;
    if (s.topRight1 !== undefined || s.topRight2 !== undefined) {
      s.note2 = [s.topRight1, s.topRight2].filter((v) => v !== undefined && v !== '').join('\n');
    }
    if (s.bottomLeft !== undefined) s.note3 = String(s.bottomLeft).replaceAll('\\n', '\n');
    if (s.showScale === false) s.scalePos = 'hidden';
    if (s.showPlaceLabels === false) s.showNeighbourhoodLabels = false;
    for (const key of ['topLeft1', 'topLeft2', 'topRight1', 'topRight2', 'bottomLeft', 'showScale']) delete s[key];
  }
  // Colours added later derive from the saved ones, so an old "Night" sheet stays dark.
  if (s.paper !== undefined && s.sheet === undefined) return completeTheme({ ...LOOK_DEFAULTS, ...s });
  return s;
}
