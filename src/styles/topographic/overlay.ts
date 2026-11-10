import { DEM_ATTRIBUTION, OSM_ATTRIBUTION } from '../../credits';
import {
  formatDegrees,
  formatScale,
  graticuleStep,
  graticuleValues,
  groupThousands,
  niceFloor,
} from '../../geo';
import type { ElementBox, OverlayScene, PaperSize, RectMm, StyleConfig } from '../../types';

const STRINGS: Record<string, { scale: string }> = {
  en: { scale: 'Scale' },
  pt: { scale: 'Escala' },
  es: { scale: 'Escala' },
  fr: { scale: 'Échelle' },
};


/** Frame elements; each one is placed freely on the sheet (see `FrameElement`). */
export const ELEMENTS = ['title', 'subtitle', 'note1', 'note2', 'note3', 'scale', 'north', 'attrib'] as const;
type ElementId = (typeof ELEMENTS)[number];

type Align = 'left' | 'center' | 'right';

// ── Metrics ───────────────────────────────────────────────────────────────────

type Side = 'Top' | 'Right' | 'Bottom' | 'Left';

/** Frame proportions all derive from the sheet's short side, so any size looks alike. */
function metrics(c: StyleConfig, paper: PaperSize) {
  const unit = Math.min(paper.widthMm, paper.heightMm);
  const small = unit * 0.0085; // grid labels, attribution
  const meta = unit * 0.0115; // notes
  const tick = small * 0.7;
  /** Top and bottom margins hold the texts; the sides are a plain border. */
  const margin = (side: Side) =>
    Math.max(0, side === 'Top' || side === 'Bottom' ? unit * 0.105 * Number(c[`margin${side}`]) : unit * 0.045 * Number(c.margin));
  const labelBand = (side: Side) => (side === 'Top' || side === 'Bottom' ? small * 2.2 : tick + 0.6 + small * 3.9);
  return {
    unit,
    small,
    meta,
    title: unit * 0.034 * Number(c.titleSize),
    gap: meta * 0.6,
    tick,
    margin,
    /** Graticule labels go on every side whose margin is wide enough for them. */
    labelsOn: (side: Side) => String(c.grid) !== 'none' && margin(side) >= labelBand(side),
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

/** Elements whose typeface can be picked one by one. */
export const TEXT_ELEMENTS = ['title', 'subtitle', 'note1', 'note2', 'note3'] as const;

/**
 * Font an element's text is drawn with: its own `${id}FontFace` / `${id}FontWeight`
 * when set, otherwise the theme's (title font for the title, text font for the rest).
 */
export function elementFont(c: StyleConfig, id: string): { name: string; weight: number } {
  const title = id === 'title';
  return {
    name: String(c[`${id}FontFace`] || (title ? c.titleFont : c.textFont)),
    weight: Number(c[`${id}FontWeight`] || (title ? c.titleWeight : 400)),
  };
}

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
  const totalM = niceFloor(p.scene.mapRect.w * 0.2 * groundMPerMm);
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
    const font = elementFont(c, key);
    return textBlock(lines, m.meta * Number(c[`${key}Size`] ?? 1), {
      family: family(font.name, '"Arial Narrow", sans-serif'),
      weight: font.weight,
      color: String(c.frame),
      spacing: 0.04,
    });
  };
  switch (id) {
    case 'title': {
      const lines = text('title');
      if (!lines.length) return null;
      const font = elementFont(c, 'title');
      return textBlock(lines, m.title, {
        family: family(font.name, 'serif'),
        weight: font.weight,
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

export function topographicMapRect(c: StyleConfig, paper: PaperSize): RectMm {
  const m = metrics(c, paper);
  const left = m.margin('Left');
  const top = m.margin('Top');
  const w = Math.max(10, paper.widthMm - left - m.margin('Right'));
  const h = Math.max(10, paper.heightMm - top - m.margin('Bottom'));
  return { x: left, y: top, w, h };
}

const alignOf = (c: StyleConfig, id: string): Align => {
  const a = String(c[`${id}Align`]);
  return a === 'left' || a === 'right' ? a : 'center';
};

interface Placed {
  block: Block;
  /** Anchor x (left edge, centre or right edge per `align`). */
  x: number;
  align: Align;
  box: ElementBox;
}

/** Visible elements with their boxes; `{id}X`/`{id}Y` are fractions of the sheet. */
function placeElements(p: Painter): Placed[] {
  const { paper } = p.scene;
  const out: Placed[] = [];
  for (const id of ELEMENTS) {
    if (p.c[`${id}Show`] === false) continue;
    const block = elementBlock(id, p.c, p.m);
    if (!block) continue;
    const align = alignOf(p.c, id);
    const w = block.width(p);
    const x = Number(p.c[`${id}X`]) * paper.widthMm;
    const y = Number(p.c[`${id}Y`]) * paper.heightMm;
    const left = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
    out.push({ block, x, align, box: { id, x: left, y, w, h: block.height } });
  }
  return out;
}

const overlaps = (a: RectMm, b: RectMm) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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

export function drawTopographicOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene, c: StyleConfig): ElementBox[] {
  const k = scene.pxPerMm;
  const m = metrics(c, scene.paper);
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
  ctx.strokeStyle = String(c.frame);
  ctx.lineWidth = 0.35 * k;
  ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);

  drawOuterBorder(p);

  // Elements over the map get a sheet-coloured box so they stay legible.
  const placed = placeElements(p);
  const pad = m.meta * 0.7;
  for (const { block, x, align, box } of placed) {
    if (String(c.insetBox) !== 'none' && overlaps(box, r)) {
      const bx = (box.x - pad) * k;
      const by = (box.y - pad) * k;
      const bw = (box.w + 2 * pad) * k;
      const bh = (box.h + 2 * pad) * k;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = String(c.sheet);
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      if (c.insetBox === 'box-border') {
        ctx.strokeStyle = String(c.frame);
        ctx.lineWidth = 0.25 * k;
        ctx.strokeRect(bx, by, bw, bh);
      }
    }
    ctx.save();
    block.draw(p, x, box.y, align);
    ctx.restore();
  }
  ctx.restore();
  return placed.map((e) => e.box);
}

function drawOuterBorder(p: Painter): void {
  const style = String(p.c.outerBorder);
  if (style === 'none') return;
  const { ctx, k, m, scene } = p;
  const W = scene.paper.widthMm;
  const H = scene.paper.heightMm;
  const d = m.unit * 0.014;
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
  const step = graticuleStep(shortSpan, 5);
  const lngs = graticuleValues(west, east, step);
  const lats = graticuleValues(south, north, step);
  const xOf = (lng: number) => scene.project([lng, scene.center[1]])[0];
  const yOf = (lat: number) => scene.project([scene.center[0], lat])[1];

  if (gridMode === 'lines' || gridMode === 'ticks') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    if (gridMode === 'lines') {
      ctx.lineWidth = 0.12 * k;
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
      ctx.lineWidth = 0.2 * k;
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
