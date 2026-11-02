import type { Control, StyleConfig } from '../types';

/** Builds a form field for `control`, calling `onChange` with the new value. */
export function renderControl(
  control: Control,
  config: StyleConfig,
  onChange: (key: string, value: string | number | boolean) => void,
): HTMLElement {
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
      break;
    }
    case 'select': {
      const select = document.createElement('select');
      for (const o of control.options) select.add(new Option(o.label, o.value, false, o.value === String(value)));
      select.addEventListener('change', () => onChange(control.key, select.value));
      row.append(name, select);
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
