import { DEM_ATTRIBUTION, OSM_ATTRIBUTION } from '../../credits';
import {
  formatDegrees,
  formatScale,
  graticuleStep,
  graticuleValues,
  groupThousands,
  niceFloor,
} from '../../geo';
import type { OverlayScene, PaperSize, RectMm, StyleConfig } from '../../types';

const STRINGS: Record<string, { scale: string }> = {
  en: { scale: 'Scale' },
  pt: { scale: 'Escala' },
  es: { scale: 'Escala' },
  fr: { scale: 'Échelle' },
};


// ── Slots ─────────────────────────────────────────────────────────────────────

/** Where a frame element sits: in the band above/below the map, inside a map corner, or nowhere. */
export const SLOTS = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
  'map-top-left', 'map-top-center', 'map-top-right',
  'map-bottom-left', 'map-bottom-center', 'map-bottom-right',
  'hidden',
] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_OPTIONS = [
  { value: 'top-left', label: 'Top band · left' },
  { value: 'top-center', label: 'Top band · centre' },
  { value: 'top-right', label: 'Top band · right' },
  { value: 'bottom-left', label: 'Bottom band · left' },
  { value: 'bottom-center', label: 'Bottom band · centre' },
  { value: 'bottom-right', label: 'Bottom band · right' },
  { value: 'map-top-left', label: 'On the map · top left' },
  { value: 'map-top-center', label: 'On the map · top centre' },
  { value: 'map-top-right', label: 'On the map · top right' },
  { value: 'map-bottom-left', label: 'On the map · bottom left' },
  { value: 'map-bottom-center', label: 'On the map · bottom centre' },
  { value: 'map-bottom-right', label: 'On the map · bottom right' },
  { value: 'hidden', label: 'Hidden' },
];

/** Frame elements in stacking order: earlier ones sit higher when they share a slot. */
export const ELEMENTS = ['title', 'note1', 'subtitle', 'note2', 'note3', 'scale', 'north', 'attrib'] as const;
type ElementId = (typeof ELEMENTS)[number];

type Align = 'left' | 'center' | 'right';

// ── Metrics ───────────────────────────────────────────────────────────────────

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
type Side = (typeof SIDES)[number];

/** Frame proportions all derive from the sheet's short side, so any size looks alike. */
function metrics(c: StyleConfig, paper: PaperSize) {
  const unit = Math.min(paper.widthMm, paper.heightMm);
  const small = unit * 0.0085; // grid labels, attribution
  const meta = unit * 0.0115; // notes
  const margin = (side: Side) => Math.max(0, unit * 0.045 * Number(c.margin) * Number(c[`margin${side}`] ?? 1));
  const gridOn = String(c.grid) !== 'none';
  const tick = small * 0.7;
  const labelsOn = (side: Side) => gridOn && Boolean(c[`gridLabels${side}`]);
  return {
    unit,
    small,
    meta,
    title: unit * 0.034 * Number(c.titleSize),
    gap: meta * 0.6,
    tick,
    margin,
    labelsOn,
    /** Room the graticule labels need outside the neatline on each side. */
    labelBand: (side: Side) =>
      !labelsOn(side) ? 0 : side === 'Top' || side === 'Bottom' ? small * 2.2 : tick + 0.6 + small * 3.9,
  };
}
type Metrics = ReturnType<typeof metrics>;

// ── Blocks ────────────────────────────────────────────────────────────────────

interface Painter {
  ctx: CanvasRenderingContext2D;
  scene: OverlayScene;
  k: number;
  c: StyleConfig;
  m: Metrics;
}

/** A frame element: fixed height (known before the map is laid out), width known when drawing. */
interface Block {
  height: number;
  width(p: Painter): number;
  /** `x` is the left edge, centre or right edge depending on `align`. */
  draw(p: Painter, x: number, top: number, align: Align): void;
}

const family = (name: unknown, fallback: string) => `"${String(name)}", ${fallback}`;
const textFamily = (c: StyleConfig) => family(c.textFont, '"Arial Narrow", sans-serif');

function setFont(p: Painter, sizeMm: number, fam: string, weight = 400, spacingEm = 0): void {
  p.ctx.font = `${weight} ${sizeMm * p.k}px ${fam}`;
  if ('letterSpacing' in p.ctx) p.ctx.letterSpacing = `${spacingEm * sizeMm * p.k}px`;
}

/** Lines may be split by real newlines or a typed "\n". */
export const splitLines = (text: string) => text.split(/\r?\n|\\n/);

function textBlock(
  lines: string[],
  size: number,
  opts: { family: string; weight?: number; color: string; spacing?: number; lineHeight?: number },
): Block {
  const lh = size * (opts.lineHeight ?? 1.35);
  const apply = (p: Painter) => setFont(p, size, opts.family, opts.weight ?? 400, opts.spacing ?? 0);
  return {
    height: lines.length * lh,
    width(p) {
      apply(p);
      return Math.max(...lines.map((l) => p.ctx.measureText(fillTokens(l, p.scene)).width)) / p.k;
    },
    draw(p, x, top, align) {
      apply(p);
      p.ctx.fillStyle = opts.color;
      p.ctx.textAlign = align;
      p.ctx.textBaseline = 'alphabetic';
      lines.forEach((line, i) => {
        const baseline = top + i * lh + (lh - size) / 2 + size * 0.8;
        p.ctx.fillText(fillTokens(line, p.scene), x * p.k, baseline * p.k);
      });
    },
  };
}

function scaleGeometry(p: Painter) {
  const s = Number(p.c.scaleSize);
  const groundMPerMm = p.scene.scale / 1000;
  const totalM = niceFloor(p.scene.mapRect.w * 0.2 * Number(p.c.scaleLength) * groundMPerMm);
  const lead = Math.round(totalM / 10 ** Math.floor(Math.log10(totalM)));
  const segments = lead === 2 ? 4 : 5;
  const segM = totalM / segments;
  const segMm = segM / groundMPerMm;
  const useKm = totalM >= 1000;
  const fmt = (meters: number) => (useKm ? String(+(meters / 1000).toFixed(2)) : groupThousands(meters));
  const labelSize = p.m.small * s;
  setFont(p, labelSize, textFamily(p.c));
  const unitLabel = ` ${useKm ? 'km' : 'm'}`;
  const lastW = p.ctx.measureText(fmt(totalM)).width / p.k;
  const overhang = lastW / 2 + p.ctx.measureText(unitLabel).width / p.k;
  return { segments, segM, segMm, barW: segMm * segments, fmt, unitLabel, labelSize, overhang, firstHalf: p.ctx.measureText('0').width / p.k / 2 };
}

function scaleBlock(c: StyleConfig, m: Metrics): Block {
  const s = Number(c.scaleSize);
  const style = String(c.scaleStyle);
  const textH = style === 'bar' ? 0 : m.meta * s * 1.5;
  const barH = style === 'text' ? 0 : m.small * s * 0.55 + m.small * s * 1.5;
  const caption = (p: Painter) => `${(STRINGS[String(p.c.frameLanguage)] ?? STRINGS.en).scale} ${formatScale(p.scene.scale)}`;
  return {
    height: textH + barH,
    width(p) {
      let w = 0;
      if (style !== 'text') {
        const g = scaleGeometry(p);
        w = g.firstHalf + g.barW + g.overhang;
      }
      if (style !== 'bar') {
        setFont(p, p.m.meta * s, textFamily(p.c));
        w = Math.max(w, p.ctx.measureText(caption(p)).width / p.k);
      }
      return w;
    },
    draw(p, x, top, align) {
      const { ctx, k } = p;
      const ink = String(p.c.frame);
      const w = this.width(p);
      const left = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      if (style !== 'bar') {
        setFont(p, p.m.meta * s, textFamily(p.c));
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(caption(p), (left + w / 2) * k, top * k);
      }
      if (style === 'text') return;
      const g = scaleGeometry(p);
      const span = g.firstHalf + g.barW + g.overhang;
      const x0 = left + (w - span) / 2 + g.firstHalf;
      const y0 = top + textH;
      const h = p.m.small * s * 0.55;
      ctx.lineWidth = 0.15 * k;
      ctx.strokeStyle = ink;
      for (let i = 0; i < g.segments; i++) {
        ctx.fillStyle = i % 2 === 0 ? ink : String(p.c.sheet);
        ctx.fillRect((x0 + i * g.segMm) * k, y0 * k, g.segMm * k, h * k);
      }
      ctx.strokeRect(x0 * k, y0 * k, g.barW * k, h * k);
      setFont(p, g.labelSize, textFamily(p.c));
      ctx.fillStyle = ink;
      ctx.textBaseline = 'top';
      for (let i = 0; i <= g.segments; i++) {
        const value = g.fmt(i * g.segM);
        ctx.textAlign = i === g.segments ? 'left' : 'center';
        const lx = i === g.segments ? x0 + g.barW - ctx.measureText(value).width / k / 2 : x0 + i * g.segMm;
        ctx.fillText(i === g.segments ? value + g.unitLabel : value, lx * k, (y0 + h + g.labelSize * 0.4) * k);
      }
    },
  };
}

function northBlock(c: StyleConfig, m: Metrics): Block {
  const h = m.unit * 0.045 * Number(c.northSize);
  const style = String(c.northStyle);
  const w = style === 'compass' ? h * 0.75 : h * 0.45;
  return {
    height: h,
    width: () => w,
    draw(p, x, top, align) {
      const { ctx, k } = p;
      const ink = String(p.c.frame);
      const cx = align === 'left' ? x + w / 2 : align === 'center' ? x : x - w / 2;
      const letter = h * 0.26;
      setFont(p, letter, textFamily(p.c), 600);
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', cx * k, top * k);
      const aTop = top + letter * 1.15;
      const aH = h - letter * 1.15;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.18 * k;
      ctx.lineJoin = 'miter';
      if (style === 'line') {
        ctx.beginPath();
        ctx.moveTo(cx * k, aTop * k);
        ctx.lineTo(cx * k, (aTop + aH) * k);
        ctx.moveTo((cx - aH * 0.14) * k, (aTop + aH * 0.22) * k);
        ctx.lineTo(cx * k, aTop * k);
        ctx.lineTo((cx + aH * 0.14) * k, (aTop + aH * 0.22) * k);
        ctx.lineWidth = 0.25 * k;
        ctx.stroke();
        return;
      }
      if (style === 'compass') {
        const cy = aTop + aH / 2;
        const r = aH / 2;
        const r2 = r * 0.2;
        const pts: [number, number][] = [[0, -r], [r2, -r2], [r, 0], [r2, r2], [0, r], [-r2, r2], [-r, 0], [-r2, -r2]];
        ctx.beginPath();
        pts.forEach(([dx, dy], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (cx + dx) * k, (cy + dy) * k));
        ctx.closePath();
        ctx.fillStyle = String(p.c.sheet);
        ctx.fill();
        ctx.stroke();
        // Shade the north half of each arm for the classic look.
        ctx.fillStyle = ink;
        for (const [ax, ay, bx, by] of [[0, -r, r2, -r2], [r, 0, r2, r2], [0, r, -r2, r2], [-r, 0, -r2, -r2]]) {
          ctx.beginPath();
          ctx.moveTo(cx * k, cy * k);
          ctx.lineTo((cx + ax) * k, (cy + ay) * k);
          ctx.lineTo((cx + bx) * k, (cy + by) * k);
          ctx.closePath();
          ctx.fill();
        }
        return;
      }
      // Arrow: half-filled triangle with a notch.
      const half = w / 2;
      ctx.beginPath();
      ctx.moveTo(cx * k, aTop * k);
      ctx.lineTo((cx + half) * k, (aTop + aH) * k);
      ctx.lineTo(cx * k, (aTop + aH * 0.72) * k);
      ctx.lineTo((cx - half) * k, (aTop + aH) * k);
      ctx.closePath();
      ctx.fillStyle = String(p.c.sheet);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx * k, aTop * k);
      ctx.lineTo((cx - half) * k, (aTop + aH) * k);
      ctx.lineTo(cx * k, (aTop + aH * 0.72) * k);
      ctx.closePath();
      ctx.fillStyle = ink;
      ctx.fill();
    },
  };
}

function elementBlock(id: ElementId, c: StyleConfig, m: Metrics): Block | null {
  const text = (key: string) => {
    const lines = splitLines(String(c[key] ?? ''));
    return lines.some((l) => l.trim()) ? lines : [];
  };
  const notes = (key: string) => {
    const lines = text(key);
    if (!lines.length) return null;
    return textBlock(lines, m.meta * Number(c[`${key}Size`] ?? 1), {
      family: textFamily(c),
      color: String(c.frame),
      spacing: 0.04,
    });
  };
  switch (id) {
    case 'title': {
      const lines = text('title');
      if (!lines.length) return null;
      return textBlock(lines, m.title, {
        family: family(c.titleFont, 'serif'),
        weight: Number(c.titleWeight),
        color: String(c.titleColor),
        spacing: Number(c.titleSpacing),
        lineHeight: 1.12,
      });
    }
    case 'note1':
    case 'note2':
    case 'note3':
    case 'subtitle':
      return notes(id);
    case 'scale':
      return scaleBlock(c, m);
    case 'north':
      return northBlock(c, m);
    case 'attrib': {
      const lines = [OSM_ATTRIBUTION];
      if (c.showContours || c.showHillshade) lines.push(DEM_ATTRIBUTION);
      return textBlock(lines, m.small * Number(c.attribSize), {
        family: textFamily(c),
        color: String(c.frame),
        spacing: 0.02,
        lineHeight: 1.4,
      });
    }
  }
}

function slotOf(c: StyleConfig, id: ElementId): Slot {
  const v = String(c[`${id}Pos`] ?? 'hidden') as Slot;
  return (SLOTS as readonly string[]).includes(v) ? v : 'hidden';
}

/** Blocks grouped by slot, in stacking order. */
function blocksBySlot(c: StyleConfig, m: Metrics): Map<Slot, Block[]> {
  const out = new Map<Slot, Block[]>();
  for (const id of ELEMENTS) {
    const slot = slotOf(c, id);
    if (slot === 'hidden') continue;
    const block = elementBlock(id, c, m);
    if (!block) continue;
    out.set(slot, [...(out.get(slot) ?? []), block]);
  }
  return out;
}

const stackHeight = (blocks: Block[] | undefined, gap: number) =>
  !blocks?.length ? 0 : blocks.reduce((h, b) => h + b.height, 0) + gap * (blocks.length - 1);

// ── Layout ────────────────────────────────────────────────────────────────────

function layout(c: StyleConfig, paper: PaperSize) {
  const m = metrics(c, paper);
  const slots = blocksBySlot(c, m);
  const band = (prefix: 'top' | 'bottom') =>
    Math.max(...(['left', 'center', 'right'] as const).map((a) => stackHeight(slots.get(`${prefix}-${a}`), m.gap)));
  const topContent = band('top');
  const bottomContent = band('bottom');
  // Text in a band keeps a little air from the sheet edge even with no margin.
  const outer = (side: Side, content: number) => (content > 0 ? Math.max(m.margin(side), m.meta * 0.8) : m.margin(side));
  const top = outer('Top', topContent) + (topContent ? topContent + m.gap : 0) + m.labelBand('Top');
  const bottom = outer('Bottom', bottomContent) + (bottomContent ? bottomContent + m.gap : 0) + m.labelBand('Bottom');
  const left = Math.max(m.margin('Left'), m.labelBand('Left'));
  const right = Math.max(m.margin('Right'), m.labelBand('Right'));
  const w = Math.max(10, paper.widthMm - left - right);
  const h = Math.max(10, paper.heightMm - top - bottom);
  return { m, slots, rect: { x: left, y: top, w, h } as RectMm };
}

export function topographicMapRect(config: StyleConfig, paper: PaperSize): RectMm {
  return layout(config, paper).rect;
}

export function fillTokens(text: string, scene: OverlayScene): string {
  const now = new Date();
  return text
    .replaceAll('{scale}', formatScale(scene.scale))
    .replaceAll('{lat}', formatDegrees(scene.center[1], 'lat'))
    .replaceAll('{lng}', formatDegrees(scene.center[0], 'lng'))
    .replaceAll('{zoom}', scene.zoom.toFixed(1))
    .replaceAll('{year}', String(now.getFullYear()))
    .replaceAll('{date}', now.toLocaleDateString());
}

// ── Drawing ───────────────────────────────────────────────────────────────────

export function drawTopographicOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene, c: StyleConfig): void {
  const k = scene.pxPerMm;
  const { m, slots } = layout(c, scene.paper);
  const r = scene.mapRect;
  const p: Painter = { ctx, scene, k, c, m };
  const W = scene.paper.widthMm;
  const H = scene.paper.heightMm;

  ctx.save();
  ctx.clearRect(0, 0, W * k, H * k);

  // Sheet margin: everywhere except the map window.
  ctx.beginPath();
  ctx.rect(0, 0, W * k, H * k);
  ctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
  ctx.fillStyle = String(c.sheet);
  ctx.fill('evenodd');

  drawGraticule(p);

  // Neatline.
  const neat = Number(c.neatline);
  if (neat > 0) {
    ctx.strokeStyle = String(c.frame);
    ctx.lineWidth = 0.35 * neat * k;
    ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
  }

  drawOuterBorder(p);

  // Bands above and below the map.
  const xFor = (align: Align) =>
    align === 'left' ? Math.max(r.x, m.meta) : align === 'right' ? Math.min(r.x + r.w, W - m.meta) : r.x + r.w / 2;
  const topBottom = r.y - m.labelBand('Top') - m.gap;
  const bottomTop = r.y + r.h + m.labelBand('Bottom') + m.gap;
  for (const align of ['left', 'center', 'right'] as const) {
    const above = slots.get(`top-${align}`);
    if (above) drawStack(p, above, xFor(align), topBottom - stackHeight(above, m.gap), align);
    const below = slots.get(`bottom-${align}`);
    if (below) drawStack(p, below, xFor(align), bottomTop, align);
  }

  // Elements placed on the map itself.
  const inset = m.unit * 0.02;
  const boxed = String(c.insetBox) !== 'none';
  const pad = boxed ? m.meta * 0.7 : 0;
  for (const v of ['top', 'bottom'] as const) {
    for (const align of ['left', 'center', 'right'] as const) {
      const blocks = slots.get(`map-${v}-${align}`);
      if (!blocks) continue;
      const sh = stackHeight(blocks, m.gap);
      const x = align === 'left' ? r.x + inset + pad : align === 'right' ? r.x + r.w - inset - pad : r.x + r.w / 2;
      const y = v === 'top' ? r.y + inset + pad : r.y + r.h - inset - pad - sh;
      if (boxed) {
        const sw = Math.max(...blocks.map((b) => b.width(p)));
        const bx = align === 'left' ? x : align === 'right' ? x - sw : x - sw / 2;
        ctx.save();
        ctx.globalAlpha = Number(c.insetOpacity);
        ctx.fillStyle = String(c.sheet);
        ctx.fillRect((bx - pad) * k, (y - pad) * k, (sw + 2 * pad) * k, (sh + 2 * pad) * k);
        ctx.restore();
        if (c.insetBox === 'box-border') {
          ctx.strokeStyle = String(c.frame);
          ctx.lineWidth = 0.25 * k;
          ctx.strokeRect((bx - pad) * k, (y - pad) * k, (sw + 2 * pad) * k, (sh + 2 * pad) * k);
        }
      }
      drawStack(p, blocks, x, y, align);
    }
  }
  ctx.restore();
}

function drawStack(p: Painter, blocks: Block[], x: number, top: number, align: Align): void {
  let y = top;
  for (const b of blocks) {
    p.ctx.save();
    b.draw(p, x, y, align);
    p.ctx.restore();
    y += b.height + p.m.gap;
  }
}

function drawOuterBorder(p: Painter): void {
  const style = String(p.c.outerBorder);
  if (style === 'none') return;
  const { ctx, k, m, scene } = p;
  const W = scene.paper.widthMm;
  const H = scene.paper.heightMm;
  const d = m.unit * 0.014 * Number(p.c.outerBorderInset ?? 1);
  const rect = (inset: number, width: number) => {
    ctx.lineWidth = width * k;
    ctx.strokeRect((d + inset) * k, (d + inset) * k, (W - 2 * (d + inset)) * k, (H - 2 * (d + inset)) * k);
  };
  ctx.strokeStyle = String(p.c.frame);
  const u = m.unit / 300; // line weights grow a little with the sheet
  if (style === 'thin') rect(0, 0.3 * u);
  if (style === 'double') {
    rect(0, 0.25 * u);
    rect(1.2 * u, 0.25 * u);
  }
  if (style === 'thick-thin') {
    rect(0, 1 * u);
    rect(1.6 * u, 0.25 * u);
  }
}

function drawGraticule(p: Painter): void {
  const { ctx, scene, k, c, m } = p;
  const gridMode = String(c.grid);
  if (gridMode === 'none') return;
  const r = scene.mapRect;
  const ink = String(c.gridColor);
  const [west, north] = scene.unproject(r.x, r.y);
  const [east, south] = scene.unproject(r.x + r.w, r.y + r.h);
  const shortSpan = Math.min(east - west, north - south);
  const step = graticuleStep(shortSpan, Math.max(2, Math.round(5 * Number(c.gridDensity ?? 1))));
  const lngs = graticuleValues(west, east, step);
  const lats = graticuleValues(south, north, step);
  const xOf = (lng: number) => scene.project([lng, scene.center[1]])[0];
  const yOf = (lat: number) => scene.project([scene.center[0], lat])[1];
  const weight = Number(c.gridWidth ?? 1);

  if (gridMode === 'lines' || gridMode === 'ticks') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.globalAlpha = Number(c.gridOpacity ?? 0.75);
    ctx.beginPath();
    if (gridMode === 'lines') {
      ctx.lineWidth = 0.12 * weight * k;
      for (const lng of lngs) {
        ctx.moveTo(xOf(lng) * k, r.y * k);
        ctx.lineTo(xOf(lng) * k, (r.y + r.h) * k);
      }
      for (const lat of lats) {
        ctx.moveTo(r.x * k, yOf(lat) * k);
        ctx.lineTo((r.x + r.w) * k, yOf(lat) * k);
      }
    } else {
      // Survey crosses at each intersection.
      const arm = 1.6;
      ctx.lineWidth = 0.2 * weight * k;
      for (const lng of lngs) {
        for (const lat of lats) {
          const [x, y] = scene.project([lng, lat]);
          ctx.moveTo((x - arm) * k, y * k);
          ctx.lineTo((x + arm) * k, y * k);
          ctx.moveTo(x * k, (y - arm) * k);
          ctx.lineTo(x * k, (y + arm) * k);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Ticks and labels outside the neatline, on the chosen sides.
  const { tick } = m;
  const on = { top: m.labelsOn('Top'), right: m.labelsOn('Right'), bottom: m.labelsOn('Bottom'), left: m.labelsOn('Left') };
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.2 * k;
  setFont(p, m.small, textFamily(c), 400, 0.02);
  ctx.beginPath();
  for (const lng of lngs) {
    const x = xOf(lng);
    if (on.top) {
      ctx.moveTo(x * k, r.y * k);
      ctx.lineTo(x * k, (r.y - tick) * k);
    }
    if (on.bottom) {
      ctx.moveTo(x * k, (r.y + r.h) * k);
      ctx.lineTo(x * k, (r.y + r.h + tick) * k);
    }
  }
  for (const lat of lats) {
    const y = yOf(lat);
    if (on.left) {
      ctx.moveTo(r.x * k, y * k);
      ctx.lineTo((r.x - tick) * k, y * k);
    }
    if (on.right) {
      ctx.moveTo((r.x + r.w) * k, y * k);
      ctx.lineTo((r.x + r.w + tick) * k, y * k);
    }
  }
  ctx.stroke();

  ctx.textAlign = 'center';
  for (const lng of lngs) {
    const x = xOf(lng);
    const label = formatDegrees(lng, 'lng', true);
    const half = ctx.measureText(label).width / k / 2;
    if (x - half < r.x || x + half > r.x + r.w) continue;
    if (on.top) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, x * k, (r.y - tick - m.small * 0.35) * k);
    }
    if (on.bottom) {
      ctx.textBaseline = 'top';
      ctx.fillText(label, x * k, (r.y + r.h + tick + m.small * 0.35) * k);
    }
  }
  ctx.textBaseline = 'middle';
  for (const lat of lats) {
    const y = yOf(lat);
    if (y - m.small < r.y || y + m.small > r.y + r.h) continue;
    const label = formatDegrees(lat, 'lat', true);
    if (on.left) {
      ctx.textAlign = 'right';
      ctx.fillText(label, (r.x - tick - 0.6) * k, y * k);
    }
    if (on.right) {
      ctx.textAlign = 'left';
      ctx.fillText(label, (r.x + r.w + tick + 0.6) * k, y * k);
    }
  }
}
