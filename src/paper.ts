import type { PaperSize } from './types';

export interface PaperPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

/** Sizes are given in portrait orientation. */
export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a6', name: 'A6 — 105 × 148 mm', widthMm: 105, heightMm: 148 },
  { id: 'a5', name: 'A5 — 148 × 210 mm', widthMm: 148, heightMm: 210 },
  { id: 'a4', name: 'A4 — 210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'a3', name: 'A3 — 297 × 420 mm', widthMm: 297, heightMm: 420 },
  { id: 'a2', name: 'A2 — 420 × 594 mm', widthMm: 420, heightMm: 594 },
  { id: 'a1', name: 'A1 — 594 × 841 mm', widthMm: 594, heightMm: 841 },
  { id: 'a0', name: 'A0 — 841 × 1189 mm', widthMm: 841, heightMm: 1189 },
  { id: 'letter', name: 'Letter — 8.5 × 11 in', widthMm: 215.9, heightMm: 279.4 },
  { id: 'tabloid', name: 'Tabloid — 11 × 17 in', widthMm: 279.4, heightMm: 431.8 },
  { id: '18x24', name: 'Poster — 18 × 24 in', widthMm: 457.2, heightMm: 609.6 },
  { id: '24x36', name: 'Poster — 24 × 36 in', widthMm: 609.6, heightMm: 914.4 },
  { id: '10x15', name: 'Photo — 10 × 15 cm', widthMm: 100, heightMm: 150 },
  { id: '13x18', name: 'Photo — 13 × 18 cm', widthMm: 130, heightMm: 180 },
  { id: '20x30', name: '20 × 30 cm', widthMm: 200, heightMm: 300 },
  { id: '30x40', name: '30 × 40 cm', widthMm: 300, heightMm: 400 },
  { id: '50x70', name: '50 × 70 cm', widthMm: 500, heightMm: 700 },
  { id: '70x100', name: '70 × 100 cm', widthMm: 700, heightMm: 1000 },
];

export type Orientation = 'portrait' | 'landscape';

export interface PrintSettings {
  paper: string; // preset id or 'custom'
  customWidthMm: number;
  customHeightMm: number;
  orientation: Orientation;
  dpi: number;
  quality: number; // 0..1
  /** Map CSS pixels per paper millimetre multiplier; >1 = finer lines, more detail. */
  detail: number;
}

export const DEFAULT_PRINT: PrintSettings = {
  paper: 'a3',
  customWidthMm: 400,
  customHeightMm: 300,
  orientation: 'landscape',
  dpi: 300,
  quality: 0.92,
  detail: 1,
};

export function paperSize(p: PrintSettings): PaperSize {
  const preset = PAPER_PRESETS.find((x) => x.id === p.paper);
  const w = preset ? preset.widthMm : p.customWidthMm;
  const h = preset ? preset.heightMm : p.customHeightMm;
  const [short, long] = w < h ? [w, h] : [h, w];
  return p.orientation === 'portrait'
    ? { widthMm: short, heightMm: long }
    : { widthMm: long, heightMm: short };
}

export const MM_PER_INCH = 25.4;
/** MapLibre lays out in CSS pixels; we map 1 CSS px to 1/96 in of paper at detail 1. */
export const CSS_PX_PER_MM = 96 / MM_PER_INCH;

export function cssPxPerMm(detail: number): number {
  return CSS_PX_PER_MM * detail;
}

export function pixelsFor(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}
