import type { ArtStyle } from '../types';
import { topographic } from './topographic';

export const ART_STYLES: ArtStyle[] = [topographic];

export function getArtStyle(id: string): ArtStyle {
  return ART_STYLES.find((s) => s.id === id) ?? ART_STYLES[0];
}
