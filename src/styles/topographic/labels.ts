import type { PaperSize, StyleConfig } from '../../types';

/** Sheet whose short side keeps label sizes unchanged when labels follow the paper (A3). */
const REFERENCE_SHORT_SIDE_MM = 297;

/**
 * Overall multiplier for map label sizes. Labels are laid out in CSS pixels,
 * i.e. at a fixed physical size, so on a small sheet they look huge next to
 * the map. "paper" mode shrinks/grows them with the sheet (gently, √ratio).
 */
export function labelFactor(c: StyleConfig, paper: PaperSize): number {
  const base = Number(c.labelScale ?? 1);
  if (String(c.labelSizing) !== 'paper') return base;
  const ratio = Math.min(paper.widthMm, paper.heightMm) / REFERENCE_SHORT_SIDE_MM;
  return base * Math.min(2.5, Math.max(0.35, Math.sqrt(ratio)));
}
