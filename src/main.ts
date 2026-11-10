import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { Editor, type View } from './editor';
import { exportDimensions, renderPoster } from './export';
import { formatDegrees, formatScale, parseCoordinates, zoomForScale } from './geo';
import { searchPlaces, type Place } from './geocode';
import { cssPxPerMm, DEFAULT_PRINT, PAPER_PRESETS, type PrintSettings } from './paper';
import { ART_STYLES, getArtStyle } from './styles/registry';
import type { Palette, StyleConfig, StyleValue } from './types';
import { renderControl, section } from './ui/controls';

interface AppState {
  styleId: string;
  configs: Record<string, StyleConfig>;
  /** Themes the user saved, per art style. */
  customThemes: Record<string, Palette[]>;
  print: PrintSettings;
  view: View;
}

const STORAGE_KEY = 'map-art:v1';

function loadState(): AppState {
  const fallback: AppState = {
    styleId: ART_STYLES[0].id,
    configs: {},
    customThemes: {},
    print: { ...DEFAULT_PRINT },
    view: { center: [-46.6333, -23.5505], zoom: 12 },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null;
    if (!saved) return fallback;
    const configs = { ...saved.configs };
    for (const [id, c] of Object.entries(configs)) configs[id] = getArtStyle(id).migrate?.(c) ?? c;
    return { ...fallback, ...saved, configs, print: { ...fallback.print, ...saved.print } };
  } catch {
    return fallback;
  }
}

const state = loadState();
const style = () => getArtStyle(state.styleId);
const config = (): StyleConfig => ({ ...style().defaults, ...state.configs[state.styleId] });

let saveTimer = 0;
function save(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  }, 300);
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const panel = $('#panel-style');
const stage = $('#stage');
const readout = $('#readout');

const editor = new Editor(stage, style(), config(), state.print, state.view, (view, scene) => {
  state.view = view;
  readout.textContent = `${formatDegrees(view.center[1], 'lat')} ${formatDegrees(view.center[0], 'lng')} · z${view.zoom.toFixed(2)} · ${formatScale(scene.scale)}`;
  save();
});

// ── Config updates ────────────────────────────────────────────────────────────

let configFrame = 0;
function setConfigValue(key: string, value: StyleValue): void {
  const patch: StyleConfig = { [key]: value };
  // Editing a theme colour turns the look into a custom one.
  if (style().themeKeys.includes(key)) patch.palette = '';
  state.configs[state.styleId] = { ...state.configs[state.styleId], ...patch };
  save();
  cancelAnimationFrame(configFrame);
  configFrame = requestAnimationFrame(() => {
    editor.setConfig(config());
    syncPrintForm();
  });
  if (patch.palette === '') markActiveTheme('');
}

/** Applies several settings at once and refreshes the sidebar to show them. */
function patchConfig(patch: StyleConfig): void {
  state.configs[state.styleId] = { ...state.configs[state.styleId], ...patch };
  save();
  editor.setConfig(config());
  renderStylePanel();
  syncPrintForm();
}

const themes = (): Palette[] => [...style().palettes, ...(state.customThemes[state.styleId] ?? [])];

function applyTheme(id: string): void {
  const theme = themes().find((p) => p.id === id);
  if (theme) patchConfig({ ...theme.values, palette: id });
}

function saveTheme(): void {
  const name = prompt('Name for this theme:', 'My theme')?.trim();
  if (!name) return;
  const c = config();
  const values: StyleConfig = {};
  for (const key of style().themeKeys) if (c[key] !== undefined) values[key] = c[key];
  const theme: Palette = { id: `custom-${Date.now().toString(36)}`, name, values, custom: true };
  state.customThemes[state.styleId] = [...(state.customThemes[state.styleId] ?? []), theme];
  patchConfig({ palette: theme.id });
}

function deleteTheme(id: string): void {
  const theme = themes().find((p) => p.id === id);
  if (!theme?.custom || !confirm(`Delete the theme "${theme.name}"?`)) return;
  state.customThemes[state.styleId] = (state.customThemes[state.styleId] ?? []).filter((p) => p.id !== id);
  if (config().palette === id) state.configs[state.styleId] = { ...state.configs[state.styleId], palette: '' };
  save();
  renderStylePanel();
}

function markActiveTheme(id: string): void {
  for (const b of panel.querySelectorAll<HTMLElement>('.palette[data-theme]')) {
    b.classList.toggle('active', b.dataset.theme === id);
  }
}

/** Sections the user opened or closed, kept across sidebar re-renders. */
const openSections = new Map<string, boolean>();

function renderStylePanel(): void {
  const s = style();
  const c = config();
  panel.replaceChildren();

  const looks = section('Look');
  const styleSelect = document.createElement('select');
  for (const a of ART_STYLES) styleSelect.add(new Option(a.name, a.id, false, a.id === s.id));
  styleSelect.addEventListener('change', () => {
    state.styleId = styleSelect.value;
    save();
    location.reload(); // a different art style needs a fresh editor
  });
  const desc = document.createElement('p');
  desc.className = 'muted';
  desc.textContent = s.description;
  const swatches = document.createElement('div');
  swatches.className = 'palettes';
  for (const p of themes()) {
    const b = document.createElement('div');
    b.className = `palette${c.palette === p.id ? ' active' : ''}${p.custom ? ' custom' : ''}`;
    b.dataset.theme = p.id;
    b.title = p.name;
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    const chips = document.createElement('span');
    chips.className = 'chips';
    for (const key of s.swatchKeys) {
      const chip = document.createElement('i');
      chip.style.background = String(p.values[key] ?? c[key]);
      chips.append(chip);
    }
    const label = document.createElement('span');
    label.className = 'palette-name';
    label.textContent = p.name;
    b.append(chips, label);
    if (p.custom) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'palette-delete';
      del.title = `Delete "${p.name}"`;
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTheme(p.id);
      });
      b.append(del);
    }
    b.addEventListener('click', () => applyTheme(p.id));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyTheme(p.id);
      }
    });
    swatches.append(b);
  }
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save current look as a theme';
  saveButton.addEventListener('click', saveTheme);
  const themeHint = document.createElement('p');
  themeHint.className = 'muted small';
  themeHint.textContent = 'Pick a theme, then fine-tune colours, fonts and fills below. Saved themes stay in this browser.';
  looks.body.append(field('Art style', styleSelect), desc, swatches, saveButton, themeHint);
  panel.append(looks.root);

  s.controls.forEach((group, i) => {
    const sec = section(group.title, openSections.get(group.title) ?? i === 0);
    sec.root.addEventListener('toggle', () => openSections.set(group.title, sec.root.open));
    for (const control of group.controls) sec.body.append(renderControl(control, c, setConfigValue, patchConfig));
    panel.append(sec.root);
  });
}

function field(label: string, input: HTMLElement): HTMLElement {
  const row = document.createElement('label');
  row.className = 'field';
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = label;
  row.append(span, input);
  return row;
}

// ── Location search ───────────────────────────────────────────────────────────

const searchForm = $<HTMLFormElement>('#search');
const searchInput = $<HTMLInputElement>('#search-input');
const results = $<HTMLUListElement>('#search-results');
let searchAbort: AbortController | undefined;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  const coords = parseCoordinates(q);
  if (coords) {
    editor.map.jumpTo({ center: coords.center, zoom: coords.zoom ?? editor.map.getZoom() });
    results.replaceChildren();
    return;
  }
  searchAbort?.abort();
  searchAbort = new AbortController();
  results.innerHTML = '<li class="muted">Searching…</li>';
  try {
    const places = await searchPlaces(q, searchAbort.signal);
    results.replaceChildren(...(places.length ? places.map(resultItem) : [emptyItem('No places found.')]));
  } catch (err) {
    if ((err as Error).name !== 'AbortError') results.replaceChildren(emptyItem((err as Error).message));
  }
});

function resultItem(place: Place): HTMLLIElement {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = place.label;
  b.addEventListener('click', () => {
    const [w, s, e, n] = place.bbox;
    editor.map.fitBounds([[w, s], [e, n]], { padding: 20, maxZoom: 15, animate: false });
    for (const [key, value] of Object.entries(style().textForPlace(place))) {
      setConfigValue(key, value);
      const input = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-key="${key}"]`);
      if (input) input.value = value;
    }
    results.replaceChildren();
  });
  li.append(b);
  return li;
}

function emptyItem(text: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'muted';
  li.textContent = text;
  return li;
}

const scaleSelect = $<HTMLSelectElement>('#scale-select');
scaleSelect.addEventListener('change', () => {
  const scale = Number(scaleSelect.value);
  scaleSelect.value = '';
  if (!scale) return;
  const lat = editor.map.getCenter().lat;
  editor.map.jumpTo({ zoom: zoomForScale(lat, scale, cssPxPerMm(state.print.detail)) });
});

// ── Print settings ────────────────────────────────────────────────────────────

const paperSelect = $<HTMLSelectElement>('#paper');
for (const p of PAPER_PRESETS) paperSelect.add(new Option(p.name, p.id));
paperSelect.add(new Option('Custom…', 'custom'));

const printInputs = {
  paper: paperSelect,
  customWidthMm: $<HTMLInputElement>('#custom-w'),
  customHeightMm: $<HTMLInputElement>('#custom-h'),
  dpi: $<HTMLSelectElement>('#dpi'),
  quality: $<HTMLInputElement>('#quality'),
  detail: $<HTMLInputElement>('#detail'),
};

function syncPrintForm(): void {
  const p = state.print;
  printInputs.paper.value = p.paper;
  printInputs.customWidthMm.value = String(p.customWidthMm);
  printInputs.customHeightMm.value = String(p.customHeightMm);
  printInputs.dpi.value = String(p.dpi);
  printInputs.quality.value = String(p.quality);
  printInputs.detail.value = String(p.detail);
  $('#custom-size').hidden = p.paper !== 'custom';
  $('#quality-out').textContent = `${Math.round(p.quality * 100)}%`;
  $('#detail-out').textContent = `${p.detail.toFixed(2).replace(/\.?0+$/, '')}×`;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-orientation]')) {
    b.classList.toggle('active', b.dataset.orientation === p.orientation);
  }
  const d = exportDimensions(style(), config(), p);
  const mp = (d.width * d.height) / 1e6;
  $('#output-size').textContent = `${d.width} × ${d.height} px · ${mp.toFixed(1)} MP · ${d.paper.widthMm.toFixed(0)} × ${d.paper.heightMm.toFixed(0)} mm`;
}

function updatePrint(patch: Partial<PrintSettings>): void {
  state.print = { ...state.print, ...patch };
  save();
  syncPrintForm();
  editor.setPrint(state.print);
}

printInputs.paper.addEventListener('change', () => updatePrint({ paper: paperSelect.value }));
printInputs.customWidthMm.addEventListener('change', () =>
  updatePrint({ customWidthMm: Math.max(50, Number(printInputs.customWidthMm.value) || 0) }),
);
printInputs.customHeightMm.addEventListener('change', () =>
  updatePrint({ customHeightMm: Math.max(50, Number(printInputs.customHeightMm.value) || 0) }),
);
printInputs.dpi.addEventListener('change', () => updatePrint({ dpi: Number(printInputs.dpi.value) }));
printInputs.quality.addEventListener('input', () => updatePrint({ quality: Number(printInputs.quality.value) }));
printInputs.detail.addEventListener('input', () => updatePrint({ detail: Number(printInputs.detail.value) }));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-orientation]')) {
  b.addEventListener('click', () => updatePrint({ orientation: b.dataset.orientation as PrintSettings['orientation'] }));
}

// ── Export ────────────────────────────────────────────────────────────────────

const exportButton = $<HTMLButtonElement>('#export');
const exportStatus = $('#export-status');

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  exportStatus.className = 'status';
  try {
    exportStatus.textContent = 'Waiting for map data…';
    await editor.dataReady();
    const blob = await renderPoster({
      style: style(),
      config: config(),
      print: state.print,
      view: editor.view,
      onStatus: (m) => (exportStatus.textContent = m),
    });
    const slug = String(config().title).normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'map';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${state.print.paper}-${state.print.orientation}-${state.print.dpi}dpi.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    exportStatus.textContent = `Saved ${a.download} (${(blob.size / 1e6).toFixed(1)} MB)`;
  } catch (err) {
    console.error(err);
    exportStatus.className = 'status error';
    exportStatus.textContent = (err as Error).message;
  } finally {
    exportButton.disabled = false;
  }
});

renderStylePanel();
syncPrintForm();
