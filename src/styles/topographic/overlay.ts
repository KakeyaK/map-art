import { DEM_ATTRIBUTION } from '../../dem';
import {
  formatDegrees,
  formatScale,
  graticuleStep,
  graticuleValues,
  groupThousands,
  niceFloor,
} from '../../geo';
import type { OverlayScene, PaperSize, RectMm, StyleConfig } from '../../types';

const SANS = '"Roboto Condensed", "Arial Narrow", sans-serif';

const STRINGS: Record<string, { scale: string }> = {
  en: { scale: 'Scale' },
  pt: { scale: 'Escala' },
  es: { scale: 'Escala' },
  fr: { scale: 'Échelle' },
};

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap';

/** Frame proportions all derive from the sheet's short side, so any size looks alike. */
function metrics(config: StyleConfig, paper: PaperSize) {
  const unit = Math.min(paper.widthMm, paper.heightMm);
  const margin = unit * 0.045 * Number(config.margin);
  const small = unit * 0.0085; // grid labels, attribution
  const meta = unit * 0.0115; // header / footer text
  const title = unit * 0.034 * Number(config.titleSize);
  const labelBand = small * 2.2; // grid labels just outside the neatline
  return {
    margin,
    small,
    meta,
    title,
    labelBand,
    top: margin + Math.max(title * 1.25, meta * 2.6) + labelBand,
    bottom: margin + labelBand + meta * 4.2,
  };
}

export function topographicMapRect(config: StyleConfig, paper: PaperSize): RectMm {
  const m = metrics(config, paper);
  return {
    x: m.margin,
    y: m.top,
    w: paper.widthMm - 2 * m.margin,
    h: paper.heightMm - m.top - m.bottom,
  };
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

export function drawTopographicOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene, c: StyleConfig): void {
  const k = scene.pxPerMm;
  const m = metrics(c, scene.paper);
  const r = scene.mapRect;
  const ink = String(c.frame);
  const paper = String(c.paper);
  const font = (sizeMm: number, family: string, weight = 400) => `${weight} ${sizeMm * k}px ${family}`;
  const spacing = (em: number, sizeMm: number) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${em * sizeMm * k}px`;
  };

  ctx.save();
  ctx.clearRect(0, 0, scene.paper.widthMm * k, scene.paper.heightMm * k);

  // Sheet margin: paper everywhere except the map window.
  ctx.beginPath();
  ctx.rect(0, 0, scene.paper.widthMm * k, scene.paper.heightMm * k);
  ctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
  ctx.fillStyle = paper;
  ctx.fill('evenodd');

  // Graticule.
  const [west, north] = scene.unproject(r.x, r.y);
  const [east, south] = scene.unproject(r.x + r.w, r.y + r.h);
  const shortSpan = Math.min(east - west, north - south);
  const step = graticuleStep(shortSpan, 5);
  const lngs = graticuleValues(west, east, step);
  const lats = graticuleValues(south, north, step);
  const gridMode = String(c.grid);

  if (gridMode !== 'none') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.12 * k;
    ctx.globalAlpha = 0.75;
    if (gridMode === 'lines') {
      ctx.beginPath();
      for (const lng of lngs) {
        const x = scene.project([lng, scene.center[1]])[0];
        ctx.moveTo(x * k, r.y * k);
        ctx.lineTo(x * k, (r.y + r.h) * k);
      }
      for (const lat of lats) {
        const y = scene.project([scene.center[0], lat])[1];
        ctx.moveTo(r.x * k, y * k);
        ctx.lineTo((r.x + r.w) * k, y * k);
      }
      ctx.stroke();
    } else {
      // Survey crosses at each intersection.
      const arm = 1.6;
      ctx.lineWidth = 0.2 * k;
      ctx.beginPath();
      for (const lng of lngs) {
        for (const lat of lats) {
          const [x, y] = scene.project([lng, lat]);
          ctx.moveTo((x - arm) * k, y * k);
          ctx.lineTo((x + arm) * k, y * k);
          ctx.moveTo(x * k, (y - arm) * k);
          ctx.lineTo(x * k, (y + arm) * k);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    // Ticks and labels outside the neatline.
    const tick = m.small * 0.7;
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 0.2 * k;
    ctx.font = font(m.small, SANS);
    spacing(0.02, m.small);
    ctx.beginPath();
    for (const lng of lngs) {
      const x = scene.project([lng, scene.center[1]])[0];
      ctx.moveTo(x * k, r.y * k);
      ctx.lineTo(x * k, (r.y - tick) * k);
      ctx.moveTo(x * k, (r.y + r.h) * k);
      ctx.lineTo(x * k, (r.y + r.h + tick) * k);
    }
    for (const lat of lats) {
      const y = scene.project([scene.center[0], lat])[1];
      ctx.moveTo(r.x * k, y * k);
      ctx.lineTo((r.x - tick) * k, y * k);
      ctx.moveTo((r.x + r.w) * k, y * k);
      ctx.lineTo((r.x + r.w + tick) * k, y * k);
    }
    ctx.stroke();

    ctx.textAlign = 'center';
    for (const lng of lngs) {
      const x = scene.project([lng, scene.center[1]])[0];
      const label = formatDegrees(lng, 'lng', true);
      const half = ctx.measureText(label).width / k / 2;
      if (x - half < r.x || x + half > r.x + r.w) continue;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, x * k, (r.y - tick - m.small * 0.35) * k);
      ctx.textBaseline = 'top';
      ctx.fillText(label, x * k, (r.y + r.h + tick + m.small * 0.35) * k);
    }
    ctx.textBaseline = 'middle';
    for (const lat of lats) {
      const y = scene.project([scene.center[0], lat])[1];
      if (y - m.small < r.y || y + m.small > r.y + r.h) continue;
      const label = formatDegrees(lat, 'lat', true);
      ctx.textAlign = 'right';
      ctx.fillText(label, (r.x - tick - 0.6) * k, y * k);
      ctx.textAlign = 'left';
      ctx.fillText(label, (r.x + r.w + tick + 0.6) * k, y * k);
    }
  }

  // Neatline.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.35 * k;
  ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);

  // Title and header text, sitting above the grid-label band.
  const headerBase = r.y - m.labelBand;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.font = font(m.title, `"${c.titleFont}", serif`, Number(c.titleWeight));
  spacing(Number(c.titleSpacing), m.title);
  ctx.fillText(fillTokens(String(c.title), scene), (scene.paper.widthMm / 2) * k, (headerBase - m.title * 0.3) * k);

  const corner = (lines: [string, number][], align: CanvasTextAlign, x: number) => {
    ctx.textAlign = align;
    let y = headerBase - m.meta * 0.6;
    for (const [text, size] of [...lines].reverse()) {
      if (!text) continue;
      ctx.font = font(size, SANS);
      spacing(0.04, size);
      ctx.fillText(fillTokens(text, scene), x * k, y * k);
      y -= size * 1.35;
    }
  };
  corner([[String(c.topLeft1), m.meta * 0.8], [String(c.topLeft2), m.meta]], 'left', r.x);
  corner([[String(c.topRight1), m.meta], [String(c.topRight2), m.meta * 0.8]], 'right', r.x + r.w);

  // Footer: notes left, scale centre, attribution right.
  const footerTop = r.y + r.h + m.labelBand + m.meta * 0.6;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = font(m.meta * 0.8, SANS);
  spacing(0.03, m.meta * 0.8);
  String(c.bottomLeft)
    .split('\\n')
    .forEach((line, i) => ctx.fillText(fillTokens(line, scene), r.x * k, (footerTop + i * m.meta * 1.15) * k));

  ctx.textAlign = 'right';
  ctx.font = font(m.small, SANS);
  spacing(0.02, m.small);
  ctx.fillText(OSM_ATTRIBUTION, (r.x + r.w) * k, footerTop * k);
  if (c.showContours || c.showHillshade) ctx.fillText(DEM_ATTRIBUTION, (r.x + r.w) * k, (footerTop + m.small * 1.4) * k);

  if (c.showScale) drawScaleBar(ctx, scene, c, m, footerTop);
  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  scene: OverlayScene,
  c: StyleConfig,
  m: ReturnType<typeof metrics>,
  top: number,
): void {
  const k = scene.pxPerMm;
  const ink = String(c.frame);
  const cx = scene.paper.widthMm / 2;
  const strings = STRINGS[String(c.frameLanguage)] ?? STRINGS.en;

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `400 ${m.meta * k}px ${SANS}`;
  ctx.fillText(`${strings.scale} ${formatScale(scene.scale)}`, cx * k, top * k);

  const groundMPerMm = scene.scale / 1000;
  const totalM = niceFloor(scene.mapRect.w * 0.2 * groundMPerMm);
  const lead = Math.round(totalM / 10 ** Math.floor(Math.log10(totalM)));
  const segments = lead === 2 ? 4 : 5;
  const segM = totalM / segments;
  const segMm = segM / groundMPerMm;
  const barW = segMm * segments;
  const barH = m.small * 0.55;
  const x0 = cx - barW / 2;
  const y0 = top + m.meta * 1.5;

  ctx.lineWidth = 0.15 * k;
  ctx.strokeStyle = ink;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? ink : String(c.paper);
    ctx.fillRect((x0 + i * segMm) * k, y0 * k, segMm * k, barH * k);
  }
  ctx.strokeRect(x0 * k, y0 * k, barW * k, barH * k);

  const useKm = totalM >= 1000;
  const fmt = (meters: number) => (useKm ? String(+(meters / 1000).toFixed(2)) : groupThousands(meters));
  ctx.fillStyle = ink;
  ctx.font = `400 ${m.small * k}px ${SANS}`;
  for (let i = 0; i <= segments; i++) {
    const label = i === segments ? `${fmt(i * segM)} ${useKm ? 'km' : 'm'}` : fmt(i * segM);
    ctx.textAlign = i === segments ? 'left' : 'center';
    const x = i === segments ? x0 + barW - ctx.measureText(fmt(i * segM)).width / k / 2 : x0 + i * segMm;
    ctx.fillText(label, x * k, (y0 + barH + m.small * 0.4) * k);
  }
}
