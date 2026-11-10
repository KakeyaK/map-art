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

export type StyleValue = string | number | boolean;

export type Control =
  | { type: 'text'; key: string; label: string; placeholder?: string; hint?: string }
  | { type: 'textarea'; key: string; label: string; rows?: number; placeholder?: string; hint?: string }
  | { type: 'color'; key: string; label: string }
  | { type: 'toggle'; key: string; label: string; hint?: string }
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; unit?: string; hint?: string }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; hint?: string }
  /** A small heading that splits a long group into parts. */
  | { type: 'heading'; label: string };

/**
 * A frame element (title, scale bar...) the user can drag on the poster.
 * Its settings follow a naming convention: `${id}X` / `${id}Y` place its anchor
 * as a fraction of the sheet, `${id}Align` says whether the anchor is its left
 * edge, centre or right edge, and `${id}Show` hides it.
 */
export interface FrameElement {
  id: string;
  label: string;
  /** Config key of the element's text, edited next to it in the sidebar. */
  textKey?: string;
  /** Help shown under the element's settings while it is selected. */
  textHint?: string;
  /** False when the element must stay on the print (e.g. licence credits). */
  canHide?: boolean;
  /** Extra settings shown while the element is selected. */
  controls: Control[];
}

/** Where a frame element was drawn, in paper millimetres. */
export interface ElementBox extends RectMm {
  id: string;
}

export interface ControlGroup {
  title: string;
  controls: Control[];
}

export type StyleConfig = Record<string, StyleValue>;

/** A named look: colours plus any other settings it wants to set (fonts, opacities...). */
export interface Palette {
  id: string;
  name: string;
  values: StyleConfig;
  /** Saved by the user in this browser (can be deleted). */
  custom?: boolean;
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
  /** Config keys a theme sets; "Save theme" captures exactly these. */
  themeKeys: string[];
  /** Keys whose swatches preview a theme. */
  swatchKeys: string[];
  /** Settings shown when the user picks the "Custom" theme. */
  themeControls: Control[];
  controls: ControlGroup[];
  /** Frame elements that can be dragged on the poster. */
  elements: FrameElement[];
  /** Upgrades settings saved by an older version of the style. */
  migrate?(saved: StyleConfig): StyleConfig;
  /** Where the map sits on the sheet; the rest is margin for the frame. */
  mapRect(config: StyleConfig, paper: PaperSize): RectMm;
  /** MapLibre style; `paper` lets label sizes follow the sheet size. */
  mapStyle(config: StyleConfig, paper: PaperSize): StyleSpecification;
  /** Colour of the sheet outside the map. */
  sheetColor(config: StyleConfig): string;
  /** Draws the frame and returns where each visible element ended up. */
  drawOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene, config: StyleConfig): ElementBox[];
  /** Font families the overlay draws with, loaded before every draw. */
  fonts(config: StyleConfig): string[];
  /** Text fields to fill in when the user picks a place from search. */
  textForPlace(place: Place): Record<string, string>;
}
