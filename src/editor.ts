import { maplibregl } from './maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { paperSize, cssPxPerMm, type PrintSettings } from './paper';
import { buildScene, loadFonts, mapCssSize } from './scene';
import type { ArtStyle, LngLat, OverlayScene, StyleConfig } from './types';

export interface View {
  center: LngLat;
  zoom: number;
}

const STAGE_PADDING = 40;

/**
 * Interactive poster preview. The map is laid out at its print size in CSS
 * pixels and shrunk with a CSS transform, so label placement and line weights
 * match the exported file exactly.
 */
export class Editor {
  readonly map: MapLibreMap;
  private poster: HTMLDivElement;
  private mapHost: HTMLDivElement;
  private mapEl: HTMLDivElement;
  private overlay: HTMLCanvasElement;
  private frame = 0;
  private screenPxPerMm = 1;

  constructor(
    private stage: HTMLElement,
    private style: ArtStyle,
    private config: StyleConfig,
    private print: PrintSettings,
    view: View,
    private onViewChange: (view: View, scene: OverlayScene) => void,
  ) {
    this.poster = el('div', 'poster');
    this.mapHost = el('div', 'poster-map');
    this.mapEl = el('div', 'poster-map-inner');
    this.overlay = el('canvas', 'poster-overlay');
    this.mapHost.append(this.mapEl);
    this.poster.append(this.mapHost, this.overlay);
    stage.append(this.poster);

    this.layoutElements();
    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: style.mapStyle(config, paperSize(print)),
      center: view.center,
      zoom: view.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      renderWorldCopies: false,
      pixelRatio: this.mapPixelRatio(),
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disableRotation();
    this.map.on('move', () => this.scheduleOverlay());
    this.map.on('load', () => this.scheduleOverlay());

    new ResizeObserver(() => this.layout()).observe(stage);
  }

  get view(): View {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom() };
  }

  setConfig(config: StyleConfig): void {
    this.config = config;
    this.map.setStyle(this.style.mapStyle(config, paperSize(this.print)));
    this.layout();
  }

  setPrint(print: PrintSettings): void {
    this.print = print;
    // Label sizes may follow the sheet size, so the map style can change too.
    this.map.setStyle(this.style.mapStyle(this.config, paperSize(print)));
    this.layout();
  }

  private mapPixelRatio(): number {
    return (window.devicePixelRatio || 1) * (this.screenPxPerMm / cssPxPerMm(this.print.detail));
  }

  private layoutElements(): void {
    const paper = paperSize(this.print);
    const availW = Math.max(100, this.stage.clientWidth - 2 * STAGE_PADDING);
    const availH = Math.max(100, this.stage.clientHeight - 2 * STAGE_PADDING);
    this.screenPxPerMm = Math.min(availW / paper.widthMm, availH / paper.heightMm);
    const k = this.screenPxPerMm;

    this.poster.style.width = `${paper.widthMm * k}px`;
    this.poster.style.height = `${paper.heightMm * k}px`;
    this.poster.style.background = this.style.sheetColor(this.config);

    const rect = this.style.mapRect(this.config, paper);
    Object.assign(this.mapHost.style, {
      left: `${rect.x * k}px`,
      top: `${rect.y * k}px`,
      width: `${rect.w * k}px`,
      height: `${rect.h * k}px`,
    });
    const [cssW, cssH] = mapCssSize(rect, this.print.detail);
    Object.assign(this.mapEl.style, {
      width: `${cssW}px`,
      height: `${cssH}px`,
      transform: `scale(${(rect.w * k) / cssW}, ${(rect.h * k) / cssH})`,
    });

    const dpr = window.devicePixelRatio || 1;
    this.overlay.width = Math.round(paper.widthMm * k * dpr);
    this.overlay.height = Math.round(paper.heightMm * k * dpr);
  }

  layout(): void {
    this.layoutElements();
    if (!this.map) return;
    this.map.setPixelRatio(this.mapPixelRatio());
    this.map.resize();
    this.scheduleOverlay();
  }

  private scheduleOverlay(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => void this.drawOverlay());
  }

  private async drawOverlay(): Promise<void> {
    await loadFonts(this.style.fonts(this.config));
    const paper = paperSize(this.print);
    const rect = this.style.mapRect(this.config, paper);
    const pxPerMm = this.overlay.width / paper.widthMm;
    const scene = buildScene(this.map, paper, rect, this.print.detail, pxPerMm);
    const ctx = this.overlay.getContext('2d')!;
    this.style.drawOverlay(ctx, scene, this.config);
    this.onViewChange(this.view, scene);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
