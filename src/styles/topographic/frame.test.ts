import { describe, expect, it, vi } from 'vitest';
import type { OverlayScene, StyleConfig } from '../../types';
import { layoutGrid, snapTo } from '../../grid';
import { labelFactor } from './labels';
import { migrate } from './migrate';
import { topographic } from './index';
import { drawTopographicOverlay, elementFont, topographicMapRect } from './overlay';
import { THEME_KEYS, THEMES } from './themes';

// The map style starts a DEM worker on import; these tests only need the frame.
vi.mock('./map-style', () => ({ buildMapStyle: () => ({}) }));

const A3_LANDSCAPE = { widthMm: 420, heightMm: 297 };
const base: StyleConfig = topographic.defaults;
const noMargins: StyleConfig = { margin: 0, marginTop: 0, marginBottom: 0 };

/** Canvas stand-in: text is 1 mm wide per character at any font size, drawing does nothing. */
function fakeContext(): CanvasRenderingContext2D {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : key === 'measureText' ? (t: string) => ({ width: t.length }) : () => {}),
    set: (target, key, value) => ((target[key] = value), true),
  }) as unknown as CanvasRenderingContext2D;
}

function boxes(c: StyleConfig) {
  const paper = A3_LANDSCAPE;
  const scene: OverlayScene = {
    paper, mapRect: topographicMapRect(c, paper), pxPerMm: 1, center: [0, 0], zoom: 10, scale: 50000,
    project: ([lng, lat]) => [lng, lat], unproject: (x, y) => [x, y],
  };
  return drawTopographicOverlay(fakeContext(), scene, { ...c, grid: 'none' });
}

describe('frame layout', () => {
  it('leaves room on every side by default, more above and below for the texts', () => {
    const r = topographicMapRect(base, A3_LANDSCAPE);
    expect(r.x).toBeGreaterThan(5);
    expect(r.y).toBeGreaterThan(20);
    expect(r.x + r.w).toBeLessThan(A3_LANDSCAPE.widthMm - 5);
    expect(r.y + r.h).toBeLessThan(A3_LANDSCAPE.heightMm - 20);
  });

  it('is full bleed with no margins', () => {
    expect(topographicMapRect({ ...base, ...noMargins }, A3_LANDSCAPE)).toEqual({ x: 0, y: 0, w: 420, h: 297 });
  });

  it('keeps a margin only where there is one', () => {
    const r = topographicMapRect({ ...base, ...noMargins, marginBottom: 1 }, A3_LANDSCAPE);
    expect(r).toMatchObject({ x: 0, y: 0, w: 420 });
    expect(r.h).toBeCloseTo(297 - 297 * 0.105, 6);
  });
});

describe('frame elements', () => {
  it('are placed at their anchor, as fractions of the sheet', () => {
    const c = { ...base, title: 'ABCD', titleX: 0.5, titleY: 0.1, titleAlign: 'center' };
    const title = boxes(c).find((b) => b.id === 'title')!;
    expect(title.x + title.w / 2).toBeCloseTo(210, 6);
    expect(title.y).toBeCloseTo(29.7, 6);
    expect(title.w).toBe(4);
  });

  it('grow away from their anchor according to the alignment', () => {
    const right = boxes({ ...base, note1: 'ABC', note1X: 0.5, note1Align: 'right' }).find((b) => b.id === 'note1')!;
    expect(right.x + right.w).toBeCloseTo(210, 6);
    const left = boxes({ ...base, note1: 'ABC', note1X: 0.5, note1Align: 'left' }).find((b) => b.id === 'note1')!;
    expect(left.x).toBeCloseTo(210, 6);
  });

  it('are left out when hidden or empty', () => {
    const ids = boxes({ ...base, titleShow: false, note1: '  ' }).map((b) => b.id);
    expect(ids).not.toContain('title');
    expect(ids).not.toContain('note1');
    expect(ids).toContain('subtitle');
  });

  it('all have a default position', () => {
    for (const e of topographic.elements) {
      expect(base[`${e.id}X`], e.id).toBeTypeOf('number');
      expect(base[`${e.id}Y`], e.id).toBeTypeOf('number');
    }
  });
});

describe('map label size', () => {
  it('is unchanged on A3 and smaller on A6', () => {
    expect(labelFactor({ labelScale: 1 }, A3_LANDSCAPE)).toBeCloseTo(1, 6);
    expect(labelFactor({ labelScale: 1 }, { widthMm: 105, heightMm: 148 })).toBeCloseTo(Math.sqrt(105 / 297), 6);
  });

  it('applies the user scale on top', () => {
    expect(labelFactor({ labelScale: 2 }, A3_LANDSCAPE)).toBeCloseTo(2, 6);
  });
});

describe('themes', () => {
  it('define every theme key', () => {
    for (const t of THEMES) for (const key of THEME_KEYS) expect(t.values[key], `${t.id}.${key}`).toBeDefined();
  });

  it('have unique ids', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});

describe('migrate', () => {
  it('moves old corner texts into frame elements and keeps a dark sheet dark', () => {
    const m = migrate({
      topLeft1: 'SURVEY', topLeft2: 'REGION', topRight1: 'SHEET', topRight2: '{lat}', bottomLeft: 'a\\nb',
      showScale: false, paper: '#101217', frame: '#eeeeee', road: '#f1c36b',
    });
    expect(m).toMatchObject({
      note1: 'SURVEY', subtitle: 'REGION', note2: 'SHEET\n{lat}', note3: 'a\nb', scaleShow: false,
      sheet: '#101217', halo: '#101217', titleColor: '#eeeeee', motorway: '#f1c36b',
    });
    expect(m.topLeft1).toBeUndefined();
  });

  it('turns slots into positions, stacking elements that shared one', () => {
    const m = migrate({ titlePos: 'map-bottom-center', subtitlePos: 'map-bottom-center', northPos: 'hidden', gridDensity: 2 });
    expect(m).toMatchObject({ titleShow: true, titleX: 0.5, titleAlign: 'center', subtitleShow: true, northShow: false });
    expect(Number(m.subtitleY)).toBeGreaterThan(Number(m.titleY));
    expect(m.titlePos).toBeUndefined();
    expect(m.gridDensity).toBeUndefined();
  });
});

describe('layout grid', () => {
  const map = { x: 13.4, y: 31.2, w: 393.2, h: 234.6 };
  const g = layoutGrid(map, A3_LANDSCAPE);

  it('has the map edges and centre lines on grid lines', () => {
    for (const x of [map.x, map.x + map.w / 2, map.x + map.w]) expect(snapTo(x, g.originX, g.stepX)).toBeCloseTo(x, 9);
    for (const y of [map.y, map.y + map.h / 2, map.y + map.h]) expect(snapTo(y, g.originY, g.stepY)).toBeCloseTo(y, 9);
  });

  it('has nearly square cells about 1/40 of the short side', () => {
    expect(g.stepX).toBeCloseTo(297 / 40, 0);
    expect(g.stepY).toBeCloseTo(297 / 40, 0);
  });

  it('snaps to the nearest line, in the margins too', () => {
    expect(snapTo(map.x - g.stepX * 0.6, g.originX, g.stepX)).toBeCloseTo(map.x - g.stepX, 9);
    expect(snapTo(map.x + g.stepX * 0.4, g.originX, g.stepX)).toBeCloseTo(map.x, 9);
  });
});

describe('element fonts', () => {
  const theme = { titleFont: 'Serif A', titleWeight: 500, textFont: 'Sans B' };

  it('follow the theme by default', () => {
    expect(elementFont({ ...theme, titleFontFace: '', titleFontWeight: '' }, 'title')).toEqual({ name: 'Serif A', weight: 500 });
    expect(elementFont(theme, 'note1')).toEqual({ name: 'Sans B', weight: 400 });
  });

  it('can be picked per element', () => {
    expect(elementFont({ ...theme, note1FontFace: 'Mono C', note1FontWeight: '700' }, 'note1')).toEqual({ name: 'Mono C', weight: 700 });
    expect(elementFont({ ...theme, titleFontWeight: '700' }, 'title')).toEqual({ name: 'Serif A', weight: 700 });
  });
});
