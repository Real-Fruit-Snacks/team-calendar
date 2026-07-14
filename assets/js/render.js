// assets/js/render.js
import { monthGrid } from './dates.js';
import { eventsForDate, agenda, eventMatches } from './model.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Category colors are rendered into CSS (background / var(--cat)). Restrict them
// to hex literals so a committed value like `url(https://evil/beacon)` cannot turn
// an event pill into an external-fetch tracking beacon.
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;

export function categoryColor(model, id) {
  const cat = (model.categories || []).find(c => c.id === id);
  return cat && SAFE_COLOR.test(cat.color) ? cat.color : 'var(--tc-text-dim)';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ------------------------------------------------------------------ */
/* Hover / focus tooltip                                               */
/* ------------------------------------------------------------------ */

let tooltipEl = null;

function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = el('div', 'tc-tooltip');
  tooltipEl.hidden = true;
  tooltipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function formatWhen(ev) {
  if (ev.allDay) return `${ev.date} · all-day`;
  const time = ev.start ? (ev.end ? `${ev.start}–${ev.end}` : ev.start) : '';
  return time ? `${ev.date} · ${time}` : ev.date;
}

function showTooltip(anchor, model, ev) {
  const tip = ensureTooltip();
  tip.textContent = '';
  tip.append(el('div', 'tc-tooltip__title', ev.title));
  tip.append(el('div', 'tc-tooltip__meta', formatWhen(ev)));

  const cat = (model.categories || []).find(c => c.id === ev.category);
  if (cat) {
    const row = el('div', 'tc-tooltip__cat');
    const dot = el('span', 'tc-tooltip__dot');
    dot.style.background = categoryColor(model, ev.category);
    row.append(dot, el('span', null, cat.label));
    tip.append(row);
  }
  if (ev.description) tip.append(el('div', 'tc-tooltip__desc', ev.description));

  for (const f of ev.fields || []) {
    if (!f.value) continue;
    const row = el('div', 'tc-tooltip__field');
    row.append(el('span', 'tc-tooltip__flabel', `${f.label}: `));
    row.append(el('span', null, f.value));
    tip.append(row);
  }

  tip.hidden = false;
  const a = anchor.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = a.bottom + 6;
  if (top + t.height > window.innerHeight - 8) top = a.top - t.height - 6;
  let left = a.left;
  if (left + t.width > window.innerWidth - 8) left = window.innerWidth - t.width - 8;
  tip.style.top = `${Math.max(8, top)}px`;
  tip.style.left = `${Math.max(8, left)}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.hidden = true;
}

function attachTooltip(node, model, ev) {
  node.addEventListener('mouseenter', () => showTooltip(node, model, ev));
  node.addEventListener('mouseleave', hideTooltip);
  node.addEventListener('focus', () => showTooltip(node, model, ev));
  node.addEventListener('blur', hideTooltip);
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function eventPill(model, ev, onEventClick) {
  const pill = el('button', 'tc-event', ev.allDay ? ev.title : `${ev.start ?? ''} ${ev.title}`.trim());
  pill.style.setProperty('--cat', categoryColor(model, ev.category));
  pill.addEventListener('click', (e) => { e.stopPropagation(); onEventClick && onEventClick(ev); });
  attachTooltip(pill, model, ev);
  return pill;
}

export function renderMonth(container, model, { year, month, todayISO, query, onDayClick, onEventClick }) {
  hideTooltip();
  container.innerHTML = '';
  const grid = el('div', 'tc-grid');
  for (const w of WEEKDAYS) grid.appendChild(el('div', 'tc-weekday', w));
  for (const cell of monthGrid(year, month).flat()) {
    const cellEl = el('div', 'tc-cell' + (cell.inMonth ? '' : ' tc-cell--outside') + (cell.iso === todayISO ? ' tc-cell--today' : ''));
    cellEl.appendChild(el('div', 'tc-cell__day', String(cell.day)));
    // Search hides non-matching events; the day cells themselves stay in place.
    for (const ev of eventsForDate(model, cell.iso)) {
      if (eventMatches(model, ev, query)) cellEl.appendChild(eventPill(model, ev, onEventClick));
    }
    cellEl.addEventListener('click', () => onDayClick && onDayClick(cell.iso));
    grid.appendChild(cellEl);
  }
  container.appendChild(grid);
}

export function renderAgenda(container, model, { fromISO, query, onEventClick }) {
  hideTooltip();
  container.innerHTML = '';
  const list = el('div', 'tc-agenda');
  let lastDate = null;
  const items = agenda(model, fromISO).filter(ev => eventMatches(model, ev, query));
  if (!items.length) {
    const q = String(query || '').trim();
    list.appendChild(el('div', 'tc-agenda__empty', q ? 'No matching events.' : 'No upcoming events.'));
  }
  for (const ev of items) {
    if (ev.date !== lastDate) { list.appendChild(el('div', 'tc-agenda__date', ev.date)); lastDate = ev.date; }
    const row = el('div', 'tc-agenda__row');
    const dot = el('span', 'tc-agenda__dot');
    dot.style.background = categoryColor(model, ev.category);
    row.appendChild(dot);
    row.appendChild(el('span', 'tc-agenda__time', ev.allDay ? 'all-day' : `${ev.start ?? ''}${ev.end ? '–' + ev.end : ''}`));
    const title = el('button', 'tc-agenda__title', ev.title);
    title.addEventListener('click', () => onEventClick && onEventClick(ev));
    row.appendChild(title);
    attachTooltip(row, model, ev);
    list.appendChild(row);
  }
  container.appendChild(list);
}
