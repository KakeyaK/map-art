import type { StyleSpecification } from 'maplibre-gl';
import type { Place } from './geocode';

/** Rectangle in paper millimetres, origin at the top-left corner of the sheet. */
export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaperSize {
  widthMm: number;
  heightMm: number;
}

export type LngLat = [lng: number, lat: number];

/**
 * Everything an art style needs to draw its frame (title, grid, scale bar...)
 * on top of the rendered map. All coordinates are in paper millimetres, so the
 * same drawing code serves the on-screen preview and the print export.
 */
export interface OverlayScene {
  paper: PaperSize;
  mapRect: RectMm;
  /** Canvas pixels per paper millimetre. */
  pxPerMm: number;
  center: LngLat;
  zoom: number;
  /** Map scale denominator at the map centre (1:N). */
  scale: number;
  project(lngLat: LngLat): [xMm: number, yMm: number];
  unproject(xMm: number, yMm: number): LngLat;
}

export type Control =
  | { type: 'text'; key: string; label: string; placeholder?: string; hint?: string }
  | { type: 'color'; key: string; label: string }
  | { type: 'toggle'; key: string; label: string }
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; unit?: string }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[] };

export interface ControlGroup {
  title: string;
  controls: Control[];
}

export type StyleConfig = Record<string, string | number | boolean>;

export interface Palette {
  id: string;
  name: string;
  colors: StyleConfig;
}

/**
 * A kind of map art. New kinds (transit maps, minimalist posters...) plug in by
 * implementing this interface and registering in `styles/registry.ts`.
 */
export interface ArtStyle {
  id: string;
  name: string;
  description: string;
  defaults: StyleConfig;
  palettes: Palette[];
  controls: ControlGroup[];
  /** Where the map sits on the sheet; the rest is margin for the frame. */
  mapRect(config: StyleConfig, paper: PaperSize): RectMm;
  mapStyle(config: StyleConfig): StyleSpecification;
  drawOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene, config: StyleConfig): void;
  /** Font families the overlay draws with, loaded before every draw. */
  fonts(config: StyleConfig): string[];
  /** Text fields to fill in when the user picks a place from search. */
  textForPlace(place: Place): Record<string, string>;
}
