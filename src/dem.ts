import { maplibregl } from './maplibre';
import mlcontour from 'maplibre-contour';

/**
 * Elevation from the public AWS Terrain Tiles (Terrarium encoding). One shared
 * DemSource serves contours and hillshade for every map instance, so the print
 * render reuses the tiles the preview already fetched.
 */
export const demSource = new mlcontour.DemSource({
  url: 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
  encoding: 'terrarium',
  maxzoom: 12,
  worker: true,
  cacheSize: 200,
  timeoutMs: 20_000,
});

demSource.setupMaplibre(maplibregl);

export { DEM_ATTRIBUTION } from './credits';
