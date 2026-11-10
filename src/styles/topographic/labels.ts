import type { PaperSize, StyleConfig } from '../../types';

/** Sheet whose short side keeps label sizes unchanged (A3). */
const REFERENCE_SHORT_SIDE_MM = 297;

/**
 * Overall multiplier for map label sizes. Labels are laid out in CSS pixels,
 * i.e. at a fixed physical size, so on a small sheet they would look huge next
 * to the map. They shrink/grow gently with the sheet (√ratio), times the
 * user's *Label size*.
 */
export function labelFactor(c: StyleConfig, paper: PaperSize): number {
  const ratio = Math.min(paper.widthMm, paper.heightMm) / REFERENCE_SHORT_SIDE_MM;
  return Number(c.labelScale ?? 1) * Math.min(2.5, Math.max(0.35, Math.sqrt(ratio)));
}
