import type { Control, StyleConfig, StyleValue } from '../types';

/**
 * Builds a form field for `control`, calling `onChange` with the new value,
 * or `onPatch` when a preset changes several settings at once.
 */
export function renderControl(
  control: Control,
  config: StyleConfig,
  onChange: (key: string, value: StyleValue) => void,
  onPatch: (patch: StyleConfig) => void,
): HTMLElement {
  if (control.type === 'heading') {
    const h = document.createElement('h3');
    h.className = 'field-heading';
    h.textContent = control.label;
    return h;
  }
  if (control.type === 'presets') {
    const row = document.createElement('div');
    row.className = 'field';
    const name = document.createElement('span');
    name.className = 'field-label';
    name.textContent = control.label;
    const buttons = document.createElement('div');
    buttons.className = 'preset-buttons';
    for (const preset of control.presets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = preset.label;
      b.addEventListener('click', () => onPatch(preset.values));
      buttons.append(b);
    }
    row.append(name, buttons);
    if (control.hint) row.append(hint(control.hint));
    return row;
  }
  const row = document.createElement('label');
  row.className = `field field-${control.type}`;
  const name = document.createElement('span');
  name.className = 'field-label';
  name.textContent = control.label;
  const value = config[control.key];

  switch (control.type) {
    case 'text': {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(value ?? '');
      input.dataset.key = control.key;
      if (control.placeholder) input.placeholder = control.placeholder;
      input.addEventListener('input', () => onChange(control.key, input.value));
      row.append(name, input);
      if (control.hint) row.append(hint(control.hint));
      break;
    }
    case 'textarea': {
      const input = document.createElement('textarea');
      input.rows = control.rows ?? 2;
      input.value = String(value ?? '').replaceAll('\\n', '\n');
      input.dataset.key = control.key;
      if (control.placeholder) input.placeholder = control.placeholder;
      input.addEventListener('input', () => onChange(control.key, input.value));
      row.append(name, input);
      if (control.hint) row.append(hint(control.hint));
      break;
    }
    case 'color': {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = String(value);
      input.dataset.key = control.key;
      input.addEventListener('input', () => onChange(control.key, input.value));
      row.append(input, name);
      break;
    }
    case 'toggle': {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(value);
      input.addEventListener('change', () => onChange(control.key, input.checked));
      row.append(input, name);
      if (control.hint) row.append(hint(control.hint));
      break;
    }
    case 'range': {
      const input = document.createElement('input');
      input.type = 'range';
      Object.assign(input, { min: control.min, max: control.max, step: control.step });
      input.value = String(value);
      const out = document.createElement('output');
      const show = () => (out.textContent = `${Number(input.value).toFixed(2).replace(/\.?0+$/, '')}${control.unit ?? ''}`);
      show();
      input.addEventListener('input', () => {
        show();
        onChange(control.key, Number(input.value));
      });
      const head = document.createElement('span');
      head.className = 'field-head';
      head.append(name, out);
      row.append(head, input);
      if (control.hint) row.append(hint(control.hint));
      break;
    }
    case 'select': {
      const select = document.createElement('select');
      for (const o of control.options) select.add(new Option(o.label, o.value, false, o.value === String(value)));
      select.addEventListener('change', () => onChange(control.key, select.value));
      row.append(name, select);
      if (control.hint) row.append(hint(control.hint));
      break;
    }
  }
  return row;
}

function hint(text: string): HTMLElement {
  const small = document.createElement('small');
  small.className = 'field-hint';
  small.textContent = text;
  return small;
}

export function section(title: string, open = true): { root: HTMLDetailsElement; body: HTMLDivElement } {
  const root = document.createElement('details');
  root.className = 'section';
  root.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  const body = document.createElement('div');
  body.className = 'section-body';
  root.append(summary, body);
  return { root, body };
}
