import { describe, expect, it } from 'vitest';
import {
  formatDegrees,
  formatScale,
  graticuleStep,
  graticuleValues,
  niceFloor,
  parseCoordinates,
  scaleDenominator,
  zoomForScale,
} from './geo';
import { setJfifDpi } from './jpeg';
import { paperSize, DEFAULT_PRINT, pixelsFor } from './paper';

describe('scale', () => {
  it('round-trips zoom ↔ scale', () => {
    const z = zoomForScale(-23.55, 50_000, 96 / 25.4);
    expect(scaleDenominator(-23.55, z, 96 / 25.4)).toBeCloseTo(50_000, 6);
  });

  it('matches the known equator resolution', () => {
    // z0, 512px tiles: ~78 271.5 m per CSS px at the equator.
    expect(scaleDenominator(0, 0, 1)).toBeCloseTo(78_271_517, -1);
  });

  it('formats with three significant digits', () => {
    expect(formatScale(48_523)).toBe('1:48 500');
    expect(formatScale(950)).toBe('1:950');
  });
});

describe('niceFloor', () => {
  it.each([
    [0.7, 0.5],
    [1, 1],
    [1999, 1000],
    [2500, 2000],
    [7300, 5000],
  ])('%d → %d', (v, expected) => expect(niceFloor(v)).toBeCloseTo(expected));
});

describe('graticule', () => {
  it('picks a step with at most N lines', () => {
    expect(graticuleStep(0.25, 4)).toBeCloseTo(5 / 60);
    expect(graticuleStep(3, 4)).toBe(1);
  });

  it('generates aligned values without float drift', () => {
    const v = graticuleValues(-46.78, -46.5, 5 / 60);
    expect(v.map((x) => formatDegrees(x, 'lng'))).toEqual(["46°45'W", "46°40'W", "46°35'W", "46°30'W"]);
  });

  it('formats degrees', () => {
    expect(formatDegrees(-23.5, 'lat')).toBe("23°30'S");
    expect(formatDegrees(10, 'lng', true)).toBe('10°E');
  });
});

describe('parseCoordinates', () => {
  it('parses lat, lng[, zoom]', () => {
    expect(parseCoordinates('-23.55, -46.63')).toEqual({ center: [-46.63, -23.55], zoom: undefined });
    expect(parseCoordinates('48.85 2.35 13')).toEqual({ center: [2.35, 48.85], zoom: 13 });
  });

  it('rejects place names and out-of-range values', () => {
    expect(parseCoordinates('São Paulo')).toBeNull();
    expect(parseCoordinates('95, 10')).toBeNull();
  });
});

describe('paper', () => {
  it('applies orientation', () => {
    expect(paperSize({ ...DEFAULT_PRINT, paper: 'a3', orientation: 'landscape' })).toEqual({ widthMm: 420, heightMm: 297 });
    expect(paperSize({ ...DEFAULT_PRINT, paper: 'a3', orientation: 'portrait' })).toEqual({ widthMm: 297, heightMm: 420 });
  });

  it('converts mm to pixels at dpi', () => {
    expect(pixelsFor(297, 300)).toBe(3508);
    expect(pixelsFor(420, 300)).toBe(4961);
  });
});

describe('setJfifDpi', () => {
  it('writes dpi density into a JFIF header', () => {
    const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1]);
    expect(setJfifDpi(header, 300)).toBe(true);
    expect([...header.subarray(13, 18)]).toEqual([1, 1, 44, 1, 44]);
  });

  it('leaves non-JFIF data alone', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(setJfifDpi(png, 300)).toBe(false);
  });
});
