import { describe, expect, it } from 'vitest';
import type { StyleConfig } from '../../types';
import { labelFactor } from './labels';
import { migrate } from './migrate';
import { topographicMapRect } from './overlay';
import { THEME_KEYS, THEMES } from './themes';

const A3_LANDSCAPE = { widthMm: 420, heightMm: 297 };

const base: StyleConfig = {
  title: 'TITLE', note1: 'A', subtitle: 'B', note2: 'C\nD', note3: 'E',
  titlePos: 'top-center', titleSize: 1, titleSpacing: 0, titleFont: 'x', titleWeight: 400, titleColor: '#000',
  note1Pos: 'top-left', note1Size: 0.8, subtitlePos: 'top-left', subtitleSize: 1, note2Pos: 'top-right', note2Size: 0.9,
  note3Pos: 'bottom-left', note3Size: 0.8, scalePos: 'bottom-center', scaleStyle: 'both', scaleSize: 1, scaleLength: 1,
  northPos: 'hidden', northStyle: 'arrow', northSize: 1, attribPos: 'bottom-right', attribSize: 1,
  margin: 1, marginTop: 1, marginRight: 1, marginBottom: 1, marginLeft: 1,
  grid: 'lines', gridLabelsTop: true, gridLabelsRight: true, gridLabelsBottom: true, gridLabelsLeft: true,
  textFont: 'y', frame: '#000', sheet: '#fff', showContours: true,
};

const everythingOnMap: StyleConfig = {
  titlePos: 'map-bottom-center', note1Pos: 'hidden', subtitlePos: 'map-bottom-center', note2Pos: 'hidden',
  note3Pos: 'hidden', scalePos: 'map-bottom-left', northPos: 'map-top-right', attribPos: 'map-bottom-right',
  marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, grid: 'none',
};

describe('frame layout', () => {
  it('leaves room on every side by default', () => {
    const r = topographicMapRect(base, A3_LANDSCAPE);
    expect(r.x).toBeGreaterThan(5);
    expect(r.y).toBeGreaterThan(20);
    expect(r.x + r.w).toBeLessThan(A3_LANDSCAPE.widthMm - 5);
    expect(r.y + r.h).toBeLessThan(A3_LANDSCAPE.heightMm - 20);
  });

  it('is full bleed with no borders and everything on the map', () => {
    expect(topographicMapRect({ ...base, ...everythingOnMap }, A3_LANDSCAPE)).toEqual({ x: 0, y: 0, w: 420, h: 297 });
  });

  it('keeps a border only on the sides that have one', () => {
    const r = topographicMapRect({ ...base, ...everythingOnMap, marginBottom: 1 }, A3_LANDSCAPE);
    expect(r).toMatchObject({ x: 0, y: 0, w: 420 });
    expect(r.h).toBeCloseTo(297 - 297 * 0.045, 6);
  });

  it('makes room for elements in a band even with no margin', () => {
    const r = topographicMapRect({ ...base, ...everythingOnMap, titlePos: 'top-center' }, A3_LANDSCAPE);
    expect(r.y).toBeGreaterThan(10);
    expect(r.y + r.h).toBe(297);
  });

  it('frees the band when its elements are hidden or empty', () => {
    const shown = topographicMapRect(base, A3_LANDSCAPE);
    const hidden = topographicMapRect({ ...base, note1Pos: 'hidden', subtitlePos: 'hidden', note2: '', title: '' }, A3_LANDSCAPE);
    expect(hidden.y).toBeLessThan(shown.y);
  });
});

describe('map label size', () => {
  it('is unchanged on A3 and smaller on A6 when following the paper', () => {
    const c = { labelSizing: 'paper', labelScale: 1 };
    expect(labelFactor(c, A3_LANDSCAPE)).toBeCloseTo(1, 6);
    expect(labelFactor(c, { widthMm: 105, heightMm: 148 })).toBeCloseTo(Math.sqrt(105 / 297), 6);
  });

  it('only applies the user scale in fixed mode', () => {
    expect(labelFactor({ labelSizing: 'fixed', labelScale: 0.5 }, { widthMm: 105, heightMm: 148 })).toBe(0.5);
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
      note1: 'SURVEY', subtitle: 'REGION', note2: 'SHEET\n{lat}', note3: 'a\nb', scalePos: 'hidden',
      sheet: '#101217', halo: '#101217', titleColor: '#eeeeee', motorway: '#f1c36b',
    });
    expect(m.topLeft1).toBeUndefined();
  });
});
