import { maplibregl } from './maplibre';
import type { View } from './editor';
import { setJfifDpi } from './jpeg';
import { paperSize, pixelsFor, type PrintSettings } from './paper';
import { buildScene, loadFonts, mapCssSize } from './scene';
import type { ArtStyle, StyleConfig } from './types';

export interface ExportRequest {
  style: ArtStyle;
  config: StyleConfig;
  print: PrintSettings;
  view: View;
  onStatus?: (message: string) => void;
}

/** Largest WebGL drawing buffer this GPU supports. */
export function maxRenderSize(): number {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 4096;
  const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  const size = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, viewport[0], viewport[1]);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return size;
}

export function exportDimensions(style: ArtStyle, config: StyleConfig, print: PrintSettings) {
  const paper = paperSize(print);
  const rect = style.mapRect(config, paper);
  return {
    paper,
    rect,
    width: pixelsFor(paper.widthMm, print.dpi),
    height: pixelsFor(paper.heightMm, print.dpi),
    mapWidth: pixelsFor(rect.w, print.dpi),
    mapHeight: pixelsFor(rect.h, print.dpi),
  };
}

/**
 * Renders the poster at print resolution: a hidden map with the preview's exact
 * CSS layout and camera, only with a larger pixel ratio, then the frame on top.
 */
export async function renderPoster({ style, config, print, view, onStatus }: ExportRequest): Promise<Blob> {
  const dims = exportDimensions(style, config, print);
  const [cssW, cssH] = mapCssSize(dims.rect, print.detail);
  const pixelRatio = dims.mapWidth / cssW;
  const limit = maxRenderSize();
  if (dims.mapWidth > limit || dims.mapHeight > limit) {
    throw new Error(
      `This GPU can render at most ${limit}px per side, the map needs ${dims.mapWidth}×${dims.mapHeight}px. Lower the DPI or the paper size.`,
    );
  }

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${cssW}px`,
    height: `${cssH}px`,
  });
  document.body.append(container);

  const map = new maplibregl.Map({
    container,
    style: style.mapStyle(config, dims.paper),
    center: view.center,
    zoom: view.zoom,
    pixelRatio,
    maxCanvasSize: [limit, limit],
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    renderWorldCopies: false,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
  });

  try {
    onStatus?.('Loading map data…');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for map tiles.')), 180_000);
      map.once('idle', () => {
        clearTimeout(timer);
        resolve();
      });
      map.on('error', (e) => console.warn('Export map error', e));
    });

    const mapCanvas = map.getCanvas();
    if (Math.abs(mapCanvas.width - dims.mapWidth) > 2) {
      throw new Error(`The browser limited the map render to ${mapCanvas.width}px wide (needed ${dims.mapWidth}px). Lower the DPI.`);
    }

    onStatus?.('Composing poster…');
    await loadFonts(style.fonts(config));
    const out = document.createElement('canvas');
    out.width = dims.width;
    out.height = dims.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Could not allocate a canvas this large. Lower the DPI or the paper size.');

    const pxPerMm = dims.width / dims.paper.widthMm;
    ctx.fillStyle = style.sheetColor(config);
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.drawImage(
      mapCanvas,
      dims.rect.x * pxPerMm,
      dims.rect.y * pxPerMm,
      dims.rect.w * pxPerMm,
      dims.rect.h * pxPerMm,
    );

    const overlay = document.createElement('canvas');
    overlay.width = dims.width;
    overlay.height = dims.height;
    style.drawOverlay(overlay.getContext('2d')!, buildScene(map, dims.paper, dims.rect, print.detail, pxPerMm), config);
    ctx.drawImage(overlay, 0, 0);
    overlay.width = overlay.height = 0;

    onStatus?.('Encoding JPEG…');
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', print.quality));
    out.width = out.height = 0;
    if (!blob) throw new Error('JPEG encoding failed — the image is probably too large for this browser.');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    setJfifDpi(bytes, print.dpi);
    return new Blob([bytes], { type: 'image/jpeg' });
  } finally {
    map.remove();
    container.remove();
  }
}
