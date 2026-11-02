import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre looks for its worker next to its own module, which Vite's dependency
// pre-bundling moves away; point it at the bundled worker asset explicitly.
maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
