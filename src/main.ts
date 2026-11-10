import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { Editor, type View } from './editor';
import { exportDimensions, renderPoster } from './export';
import { formatDegrees, formatScale, parseCoordinates, zoomForScale } from './geo';
import { searchPlaces, type Place } from './geocode';
import { cssPxPerMm, DEFAULT_PRINT, PAPER_PRESETS, paperSize, type PrintSettings } from './paper';
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

const editor = new Editor(
  stage,
  style(),
  config(),
  state.print,
  state.view,
  (view, scene) => {
    state.view = view;
    readout.textContent = `${formatDegrees(view.center[1], 'lat')} ${formatDegrees(view.center[0], 'lng')} · z${view.zoom.toFixed(2)} · ${formatScale(scene.scale)}`;
    save();
  },
  {
    onSelect: (id) => selectElement(id, true),
    onMove: (id, x, y) => {
      setConfigValue(`${id}X`, x);
      setConfigValue(`${id}Y`, y);
      syncPosition(id);
    },
    onHide: (id) => setElementShown(id, false),
  },
);

// ── Config updates ────────────────────────────────────────────────────────────

let configFrame = 0;
function setConfigValue(key: string, value: StyleValue): void {
  const patch: StyleConfig = { [key]: value };
  // Editing a theme setting turns the look into a custom one.
  const becameCustom = style().themeKeys.includes(key) && config().palette !== '';
  if (becameCustom) patch.palette = '';
  state.configs[state.styleId] = { ...state.configs[state.styleId], ...patch };
  save();
  cancelAnimationFrame(configFrame);
  configFrame = requestAnimationFrame(() => {
    editor.setConfig(config());
    syncPrintForm();
  });
  if (becameCustom) renderTheme();
}

function patchConfig(patch: StyleConfig): void {
  state.configs[state.styleId] = { ...state.configs[state.styleId], ...patch };
  save();
  editor.setConfig(config());
  syncPrintForm();
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const themes = (): Palette[] => [...style().palettes, ...(state.customThemes[state.styleId] ?? [])];

function applyTheme(id: string): void {
  const theme = themes().find((p) => p.id === id);
  // "Custom" keeps the current look as the starting point.
  patchConfig(theme ? { ...theme.values, palette: id } : { palette: '' });
  renderTheme();
}

function saveTheme(): void {
  const name = prompt('Name for this theme:', 'My theme')?.trim();
  if (!name) return;
  const c = config();
  const values: StyleConfig = {};
  for (const key of style().themeKeys) if (c[key] !== undefined) values[key] = c[key];
  const theme: Palette = { id: `custom-${Date.now().toString(36)}`, name, values, custom: true };
  state.customThemes[state.styleId] = [...(state.customThemes[state.styleId] ?? []), theme];
  applyTheme(theme.id);
}

function deleteTheme(id: string): void {
  const theme = themes().find((p) => p.id === id);
  if (!theme?.custom || !confirm(`Delete the theme "${theme.name}"?`)) return;
  state.customThemes[state.styleId] = (state.customThemes[state.styleId] ?? []).filter((p) => p.id !== id);
  applyTheme('');
}

const themeSection = section('Theme');

function renderTheme(): void {
  const s = style();
  const c = config();
  const body = themeSection.body;
  body.replaceChildren();

  if (ART_STYLES.length > 1) {
    const styleSelect = document.createElement('select');
    for (const a of ART_STYLES) styleSelect.add(new Option(a.name, a.id, false, a.id === s.id));
    styleSelect.addEventListener('change', () => {
      state.styleId = styleSelect.value;
      save();
      location.reload(); // a different art style needs a fresh editor
    });
    body.append(field('Art style', styleSelect));
  }

  // Collapsed it shows the current look; open, a card with a preview for every theme.
  const picker = document.createElement('details');
  picker.className = 'theme-picker';
  const current = themes().find((p) => p.id === c.palette);
  const summary = document.createElement('summary');
  const chips = swatches(s.swatchKeys, (key) => String(c[key]));
  const currentName = document.createElement('span');
  currentName.className = 'palette-name';
  currentName.textContent = current?.name ?? 'Custom';
  summary.append(chips, currentName);

  const cards = document.createElement('div');
  cards.className = 'palettes';
  const addCard = (id: string, name: string, colour: (key: string) => string, extra = '') => {
    const b = button('', () => {
      picker.open = false;
      applyTheme(id);
    }, `palette${extra}${id === c.palette ? ' active' : ''}`);
    b.title = name;
    const label = document.createElement('span');
    label.className = 'palette-name';
    label.textContent = name;
    b.append(swatches(s.swatchKeys, colour), label);
    cards.append(b);
  };
  for (const p of themes()) addCard(p.id, p.name, (key) => String(p.values[key] ?? c[key]), p.custom ? ' saved' : '');
  addCard('', 'Custom…', (key) => String(c[key]), ' custom');
  picker.append(summary, cards);
  body.append(picker);

  if (current?.custom) {
    body.append(button('Delete this theme', () => deleteTheme(current.id), 'link'));
  }
  if (!c.palette) {
    const onChange = (key: string, value: StyleValue) => {
      setConfigValue(key, value);
      const chip = chips.querySelector<HTMLElement>(`[data-swatch="${key}"]`);
      if (chip) chip.style.background = String(value);
    };
    const custom = document.createElement('div');
    custom.className = 'theme-custom';
    for (const control of s.themeControls) custom.append(renderControl(control, c, onChange));
    body.append(custom, button('Save as a theme', saveTheme));
    body.append(muted('Starts from the last theme you picked. Saved themes stay in this browser.'));
  }
}

// ── Frame elements ────────────────────────────────────────────────────────────

const elementsSection = section('Elements');
let selected: string | null = null;

const card = (id: string) => elementsSection.body.querySelector<HTMLElement>(`[data-element="${id}"]`);

function renderElements(): void {
  const c = config();
  const body = elementsSection.body;
  body.replaceChildren(muted('Drag elements on the poster to move them. Select one to adjust it; × or Delete hides it.'));
  for (const def of style().elements) {
    const root = document.createElement('div');
    root.className = 'element';
    root.dataset.element = def.id;
    root.classList.toggle('is-hidden', c[`${def.id}Show`] === false);

    const head = document.createElement('div');
    head.className = 'element-head';
    if (def.canHide !== false) {
      const show = document.createElement('input');
      show.type = 'checkbox';
      show.checked = c[`${def.id}Show`] !== false;
      show.title = 'Show on the poster';
      show.dataset.show = def.id;
      show.addEventListener('change', () => setElementShown(def.id, show.checked));
      head.append(show);
    }
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'element-name';
    name.textContent = def.label;
    name.addEventListener('click', () => selectElement(selected === def.id ? null : def.id));
    head.append(name);
    root.append(head);

    if (def.textKey) {
      const key = def.textKey;
      const text = document.createElement('textarea');
      text.rows = Math.max(1, String(c[key] ?? '').split('\n').length);
      text.value = String(c[key] ?? '').replaceAll('\\n', '\n');
      text.dataset.key = key;
      text.addEventListener('input', () => setConfigValue(key, text.value));
      text.addEventListener('focus', () => selected !== def.id && selectElement(def.id));
      root.append(text);
    }
    const detail = document.createElement('div');
    detail.className = 'element-detail';
    root.append(detail);
    body.append(root);
  }
  selectElement(selected);
}

/** Selects an element in the sidebar and on the poster; `reveal` scrolls its card into view. */
function selectElement(id: string | null, reveal = false): void {
  selected = id;
  editor.setSelected(id);
  for (const el of elementsSection.body.querySelectorAll<HTMLElement>('.element')) {
    const on = el.dataset.element === id;
    el.classList.toggle('selected', on);
    const detail = el.querySelector<HTMLElement>('.element-detail')!;
    if (on && !detail.childElementCount) fillDetail(el.dataset.element!, detail);
    if (!on) detail.replaceChildren();
  }
  if (id && reveal) {
    elementsSection.root.open = true;
    card(id)?.scrollIntoView({ block: 'nearest' });
  }
}

function fillDetail(id: string, detail: HTMLElement): void {
  const def = style().elements.find((e) => e.id === id)!;
  const c = config();
  const coord = (axis: 'X' | 'Y') => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.5';
    input.dataset.coord = axis;
    input.addEventListener('change', () => {
      const paper = paperSize(state.print);
      const size = axis === 'X' ? paper.widthMm : paper.heightMm;
      setConfigValue(`${id}${axis}`, Math.min(1, Math.max(0, Number(input.value) / size)));
    });
    return field(`${axis} (mm)`, input);
  };
  const xy = document.createElement('div');
  xy.className = 'row';
  xy.append(coord('X'), coord('Y'));

  const align = document.createElement('div');
  align.className = 'segmented segmented-3';
  for (const [value, label] of [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] as const) {
    const b = button(label, () => setAlign(id, value));
    b.dataset.align = value;
    b.classList.toggle('active', String(c[`${id}Align`]) === value);
    align.append(b);
  }
  const alignField = document.createElement('div');
  alignField.className = 'field';
  const alignLabel = document.createElement('span');
  alignLabel.className = 'field-label';
  alignLabel.textContent = 'Align';
  alignField.append(alignLabel, align);

  detail.append(xy, alignField);
  for (const control of def.controls) detail.append(renderControl(control, c, setConfigValue));
  if (def.textHint) detail.append(muted(def.textHint));
  syncPosition(id);
}

/** Changes alignment while keeping the element where it is on the sheet. */
function setAlign(id: string, align: 'left' | 'center' | 'right'): void {
  const box = editor.elementBox(id);
  if (box) {
    const x = align === 'left' ? box.x : align === 'center' ? box.x + box.w / 2 : box.x + box.w;
    setConfigValue(`${id}X`, x / paperSize(state.print).widthMm);
  }
  setConfigValue(`${id}Align`, align);
  for (const b of card(id)?.querySelectorAll<HTMLElement>('[data-align]') ?? []) {
    b.classList.toggle('active', b.dataset.align === align);
  }
  syncPosition(id);
}

/** Shows the element's position in the sidebar, in millimetres of the current sheet. */
function syncPosition(id: string): void {
  const el = card(id);
  if (!el) return;
  const c = config();
  const paper = paperSize(state.print);
  for (const input of el.querySelectorAll<HTMLInputElement>('[data-coord]')) {
    const axis = input.dataset.coord as 'X' | 'Y';
    if (document.activeElement === input) continue;
    input.value = (Number(c[`${id}${axis}`]) * (axis === 'X' ? paper.widthMm : paper.heightMm)).toFixed(1);
  }
}

function setElementShown(id: string, show: boolean): void {
  setConfigValue(`${id}Show`, show);
  const el = card(id);
  el?.classList.toggle('is-hidden', !show);
  const box = el?.querySelector<HTMLInputElement>('[data-show]');
  if (box) box.checked = show;
  if (!show && selected === id) selectElement(null);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderStylePanel(): void {
  const s = style();
  renderTheme();
  renderElements();
  panel.replaceChildren(themeSection.root, elementsSection.root);
  for (const group of s.controls) {
    const sec = section(group.title, false);
    for (const control of group.controls) sec.body.append(renderControl(control, config(), setConfigValue));
    panel.append(sec.root);
  }
}

function swatches(keys: string[], colour: (key: string) => string): HTMLElement {
  const chips = document.createElement('span');
  chips.className = 'chips';
  for (const key of keys) {
    const chip = document.createElement('i');
    chip.style.background = colour(key);
    chip.dataset.swatch = key;
    chips.append(chip);
  }
  return chips;
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

function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function muted(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'muted small';
  p.textContent = text;
  return p;
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
  if (selected) syncPosition(selected);
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
