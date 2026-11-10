import { maplibregl } from './maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { layoutGrid, snapTo, type LayoutGrid } from './grid';
import { paperSize, cssPxPerMm, type PrintSettings } from './paper';
import { buildScene, loadFonts, mapCssSize } from './scene';
import type { ArtStyle, ElementBox, LngLat, OverlayScene, StyleConfig } from './types';

export interface View {
  center: LngLat;
  zoom: number;
}

/** What the user does with frame elements on the poster. */
export interface ElementHandlers {
  /** An element was clicked, or `null` when the click landed elsewhere. */
  onSelect(id: string | null): void;
  /** An element was dragged; `x`/`y` are its new anchor as fractions of the sheet. */
  onMove(id: string, x: number, y: number): void;
  /** The user asked to hide an element (× button or Delete key). */
  onHide(id: string): void;
}

const STAGE_PADDING = 40;
/** Screen pixels of slack around an element for clicking it. */
const HIT_SLOP_PX = 4;
/** Arrow keys with Alt move this far instead of a whole grid cell. */
const NUDGE_MM = 0.5;

interface Drag {
  id: string;
  pointerId: number;
  start: [number, number];
  /** Anchor at the start of the drag, in mm. */
  anchor: [number, number];
}

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
  private selection: HTMLDivElement;
  private grid: HTMLDivElement;
  private frame = 0;
  private screenPxPerMm = 1;
  private mapStyleJson = '';
  private boxes: ElementBox[] = [];
  private selected: string | null = null;
  private drag: Drag | null = null;

  constructor(
    private stage: HTMLElement,
    private style: ArtStyle,
    private config: StyleConfig,
    private print: PrintSettings,
    view: View,
    private onViewChange: (view: View, scene: OverlayScene) => void,
    private handlers: ElementHandlers,
  ) {
    this.poster = el('div', 'poster');
    this.mapHost = el('div', 'poster-map');
    this.mapEl = el('div', 'poster-map-inner');
    this.overlay = el('canvas', 'poster-overlay');
    this.selection = el('div', 'poster-selection');
    this.grid = el('div', 'poster-grid');
    this.mapHost.append(this.mapEl);
    this.poster.append(this.mapHost, this.overlay, this.grid, this.selection);
    stage.append(this.poster);

    const hide = el('button', 'poster-selection-hide');
    hide.type = 'button';
    hide.title = 'Hide (Delete)';
    hide.textContent = '×';
    hide.addEventListener('click', () => this.selected && this.handlers.onHide(this.selected));
    this.selection.append(hide);

    this.layoutElements();
    this.mapStyleJson = JSON.stringify(style.mapStyle(config, paperSize(print)));
    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: JSON.parse(this.mapStyleJson),
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
    this.listenForElements();
  }

  get view(): View {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom() };
  }

  setConfig(config: StyleConfig): void {
    this.config = config;
    this.updateMapStyle();
    this.layout();
  }

  setPrint(print: PrintSettings): void {
    this.print = print;
    // Label sizes follow the sheet size, so the map style can change too.
    this.updateMapStyle();
    this.layout();
  }

  /** Highlights an element on the poster (without notifying `onSelect`). */
  setSelected(id: string | null): void {
    this.selected = id;
    this.updateSelection();
  }

  /** Where an element was last drawn, in paper mm. */
  elementBox(id: string): ElementBox | undefined {
    return this.boxes.find((b) => b.id === id);
  }

  /** Frame-only changes (texts, positions) leave the map style alone, which keeps dragging smooth. */
  private updateMapStyle(): void {
    const json = JSON.stringify(this.style.mapStyle(this.config, paperSize(this.print)));
    if (json === this.mapStyleJson) return;
    this.mapStyleJson = json;
    this.map.setStyle(JSON.parse(json));
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
    this.boxes = this.style.drawOverlay(ctx, scene, this.config);
    this.updateSelection();
    this.onViewChange(this.view, scene);
  }

  // ── Frame elements ──────────────────────────────────────────────────────────

  private toMm(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.poster.getBoundingClientRect();
    return [(e.clientX - r.left) / this.screenPxPerMm, (e.clientY - r.top) / this.screenPxPerMm];
  }

  /** Topmost element under the pointer (elements drawn later sit on top). */
  private hitTest(e: { clientX: number; clientY: number }): ElementBox | undefined {
    const [x, y] = this.toMm(e);
    const slop = HIT_SLOP_PX / this.screenPxPerMm;
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return b;
    }
    return undefined;
  }

  private listenForElements(): void {
    const p = this.poster;
    const onHideButton = (e: Event) => (e.target as HTMLElement).closest('.poster-selection-hide');
    // Capture phase: an element under the pointer wins over panning the map below it.
    p.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 || onHideButton(e)) return;
        const hit = this.hitTest(e);
        if (!hit) {
          if (this.selected) this.handlers.onSelect(null);
          this.setSelected(null);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.setSelected(hit.id);
        this.handlers.onSelect(hit.id);
        const paper = paperSize(this.print);
        this.drag = {
          id: hit.id,
          pointerId: e.pointerId,
          start: this.toMm(e),
          anchor: [Number(this.config[`${hit.id}X`]) * paper.widthMm, Number(this.config[`${hit.id}Y`]) * paper.heightMm],
        };
        p.setPointerCapture(e.pointerId);
        p.classList.add('dragging');
        this.showGrid();
      },
      true,
    );
    // Touch and double-click events reach the map separately from pointer events.
    for (const type of ['touchstart', 'dblclick'] as const) {
      p.addEventListener(
        type,
        (e) => {
          const point = 'touches' in e ? e.touches[0] : e;
          if (point && !onHideButton(e) && this.hitTest(point)) e.stopPropagation();
        },
        true,
      );
    }
    p.addEventListener('pointermove', (e) => {
      if (!this.drag) {
        p.classList.toggle('over-element', e.pointerType === 'mouse' && !!this.hitTest(e));
        return;
      }
      if (e.pointerId !== this.drag.pointerId) return;
      const d = this.drag;
      const paper = paperSize(this.print);
      const [x, y] = this.toMm(e);
      let ax = d.anchor[0] + x - d.start[0];
      let ay = d.anchor[1] + y - d.start[1];
      // The anchor (aligned edge or centre, and the top) sticks to the grid; Alt moves freely.
      if (!e.altKey) {
        const g = this.layoutGrid();
        ax = snapTo(ax, g.originX, g.stepX);
        ay = snapTo(ay, g.originY, g.stepY);
      }
      this.grid.classList.toggle('free', e.altKey);
      this.handlers.onMove(d.id, clamp01(ax / paper.widthMm), clamp01(ay / paper.heightMm));
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      this.drag = null;
      p.classList.remove('dragging');
      this.grid.classList.remove('visible');
    };
    p.addEventListener('pointerup', end);
    p.addEventListener('pointercancel', end);

    // Capture on window so arrow keys move the element instead of panning a focused map.
    window.addEventListener(
      'keydown',
      (e) => {
        const id = this.selected;
        const t = e.target as HTMLElement;
        if (!id || t.closest('input, textarea, select, [contenteditable]')) return;
        if (e.key === 'Escape') {
          this.setSelected(null);
          this.handlers.onSelect(null);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          this.handlers.onHide(id);
        } else if (e.key.startsWith('Arrow')) {
          // One grid cell per press (landing on a grid line); Alt nudges by half a millimetre.
          const paper = paperSize(this.print);
          const g = this.layoutGrid();
          const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
          const move = (mm: number, d: number, origin: number, step: number) =>
            !d ? mm : e.altKey ? mm + d * NUDGE_MM : snapTo(mm + d * step, origin, step);
          const x = move(Number(this.config[`${id}X`]) * paper.widthMm, dx, g.originX, g.stepX);
          const y = move(Number(this.config[`${id}Y`]) * paper.heightMm, dy, g.originY, g.stepY);
          this.handlers.onMove(id, clamp01(x / paper.widthMm), clamp01(y / paper.heightMm));
        } else {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
  }

  private layoutGrid(): LayoutGrid {
    const paper = paperSize(this.print);
    return layoutGrid(this.style.mapRect(this.config, paper), paper);
  }

  /** Draws the snapping grid over the poster while an element is dragged (preview only). */
  private showGrid(): void {
    const g = this.layoutGrid();
    const k = this.screenPxPerMm;
    Object.assign(this.grid.style, {
      backgroundSize: `${g.stepX * k}px ${g.stepY * k}px`,
      backgroundPosition: `${g.originX * k}px ${g.originY * k}px`,
    });
    this.grid.classList.add('visible');
  }

  private updateSelection(): void {
    const box = this.selected ? this.elementBox(this.selected) : undefined;
    this.selection.hidden = !box;
    if (!box) return;
    const k = this.screenPxPerMm;
    const pad = HIT_SLOP_PX;
    Object.assign(this.selection.style, {
      left: `${box.x * k - pad}px`,
      top: `${box.y * k - pad}px`,
      width: `${box.w * k + 2 * pad}px`,
      height: `${box.h * k + 2 * pad}px`,
    });
    const canHide = this.style.elements.find((e) => e.id === box.id)?.canHide !== false;
    this.selection.querySelector<HTMLElement>('.poster-selection-hide')!.hidden = !canHide;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
