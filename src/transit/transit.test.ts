import { describe, expect, it } from 'vitest';
import { buildQuery, snapBBox } from './overpass';
import { lineName, normalizeColour, parseOverpass, type OverpassResponse } from './parse';

const geom = (...pts: [number, number][]) => pts.map(([lon, lat]) => ({ lat, lon }));

const sample: OverpassResponse = {
  elements: [
    {
      type: 'relation', id: 1,
      tags: { type: 'route', route: 'subway', ref: '1', name: 'Linha 1-Azul: Tucuruvi → Jabaquara', colour: '#0455A1', network: 'Metrô' },
      members: [
        { type: 'way', ref: 10, role: '', geometry: geom([-46.63, -23.50], [-46.63, -23.55]) },
        { type: 'way', ref: 11, role: '', geometry: geom([-46.63, -23.55], [-46.64, -23.60]) },
        { type: 'way', ref: 12, role: 'platform', geometry: geom([-46.63, -23.55], [-46.631, -23.551]) },
        { type: 'node', ref: 100, role: 'stop', lat: -23.55, lon: -46.63 },
      ],
    },
    {
      type: 'relation', id: 2,
      tags: { type: 'route', route: 'subway', ref: '1', name: 'Linha 1-Azul: Jabaquara → Tucuruvi', colour: '#0455A1', network: 'Metrô' },
      members: [{ type: 'way', ref: 10, role: '', geometry: geom([-46.63, -23.50], [-46.63, -23.55]) }],
    },
    {
      type: 'relation', id: 3,
      tags: { type: 'route', route: 'train', ref: '11', name: 'Linha 11-Coral', colour: 'F04E23', network: 'CPTM' },
      members: [
        { type: 'way', ref: 11, role: '', geometry: geom([-46.63, -23.55], [-46.64, -23.60]) },
        { type: 'node', ref: 101, role: 'stop', lat: -23.5502, lon: -46.6301 },
      ],
    },
    { type: 'node', id: 200, lat: -23.5501, lon: -46.6302, tags: { railway: 'station', name: 'Sé' } },
    { type: 'way', id: 201, center: { lat: -23.5503, lon: -46.6303 }, tags: { railway: 'station', name: 'Sé' } },
    { type: 'node', id: 202, lat: -23.9, lon: -46.9, tags: { railway: 'station', station: 'subway', name: 'Far' } },
  ],
};

describe('transit parsing', () => {
  const data = parseOverpass(sample);

  it('merges both directions into one line and strips the direction from the name', () => {
    expect(data.lines.map((l) => [l.mode, l.ref, l.name, l.colour])).toEqual([
      ['subway', '1', 'Linha 1-Azul', '#0455a1'],
      ['train', '11', 'Linha 11-Coral', '#f04e23'],
    ]);
  });

  it('draws lines sharing a way side by side and skips platforms', () => {
    const lines = data.geojson.features.filter((f) => f.properties?.kind === 'line');
    expect(lines.filter((f) => f.properties?.way === 12)).toHaveLength(0);
    expect(lines.filter((f) => f.properties?.way === 10).map((f) => f.properties?.slot)).toEqual([0]);
    expect(lines.filter((f) => f.properties?.way === 11).map((f) => f.properties?.slot)).toEqual([-0.5, 0.5]);
  });

  it('dedupes stations and counts the lines serving them', () => {
    const stations = data.geojson.features.filter((f) => f.properties?.kind === 'station');
    expect(stations.map((f) => [f.properties?.name, f.properties?.lines, f.properties?.mode])).toEqual([
      ['Sé', 2, 'subway'],
      ['Far', 0, 'subway'],
    ]);
  });

  it('normalises colours and names', () => {
    expect(normalizeColour('blue')).toBe('#0455a1');
    expect(normalizeColour('#ABC')).toBe('#abc');
    expect(normalizeColour('nope')).toBeNull();
    expect(lineName({ name: 'Barcas: Arariboia => Praça XV' })).toBe('Barcas');
  });
});

describe('overpass query', () => {
  it('snaps the box outwards and asks only for the chosen modes', () => {
    expect(snapBBox([-46.71, -23.62, -46.52, -23.48])).toEqual([-46.75, -23.65, -46.5, -23.45]);
    const q = buildQuery([-46.75, -23.65, -46.5, -23.45], ['subway', 'bus']);
    expect(q).toContain('"route"~"^(bus|subway|trolleybus)$"](-23.65,-46.75,-23.45,-46.5)');
    expect(q).toContain('railway');
    expect(buildQuery([0, 0, 1, 1], ['bus'])).not.toContain('railway');
  });
});
