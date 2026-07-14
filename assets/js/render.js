// assets/js/render.js
import { monthGrid } from './dates.js';
import { eventsForDate, agenda } from './model.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function categoryColor(model, id) {
  const cat = (model.categories || []).find(c => c.id === id);
  return cat ? cat.color : 'var(--tc-text-dim)';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function eventPill(model, ev, onEventClick) {
  const pill = el('button', 'tc-event', ev.allDay ? ev.title : `${ev.start ?? ''} ${ev.title}`.trim());
  pill.style.setProperty('--cat', categoryColor(model, ev.category));
  pill.addEventListener('click', (e) => { e.stopPropagation(); onEventClick && onEventClick(ev); });
  return pill;
}

export function renderMonth(container, model, { year, month, todayISO, onDayClick, onEventClick }) {
  container.innerHTML = '';
  const grid = el('div', 'tc-grid');
  for (const w of WEEKDAYS) grid.appendChild(el('div', 'tc-weekday', w));
  for (const cell of monthGrid(year, month).flat()) {
    const cellEl = el('div', 'tc-cell' + (cell.inMonth ? '' : ' tc-cell--outside') + (cell.iso === todayISO ? ' tc-cell--today' : ''));
    cellEl.appendChild(el('div', 'tc-cell__day', String(cell.day)));
    for (const ev of eventsForDate(model, cell.iso)) cellEl.appendChild(eventPill(model, ev, onEventClick));
    cellEl.addEventListener('click', () => onDayClick && onDayClick(cell.iso));
    grid.appendChild(cellEl);
  }
  container.appendChild(grid);
}

export function renderAgenda(container, model, { fromISO, onEventClick }) {
  container.innerHTML = '';
  const list = el('div', 'tc-agenda');
  let lastDate = null;
  const items = agenda(model, fromISO);
  if (!items.length) list.appendChild(el('div', 'tc-agenda__empty', 'No upcoming events.'));
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
    list.appendChild(row);
  }
  container.appendChild(list);
}
