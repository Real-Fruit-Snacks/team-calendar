// assets/js/ui.js
import { createTokenURL } from './token.js';
import { categoryColor } from './render.js';
import { MONTHS, monthLabel } from './dates.js';

const THEME_KEY = 'tc_theme';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function field(labelText, control, extraCls) {
  const wrap = el('div', 'tc-modal__field' + (extraCls ? ' ' + extraCls : ''));
  const id = 'tc-field-' + labelText.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
  control.id = id;
  const label = el('label', null, labelText);
  label.htmlFor = id;
  wrap.append(label, control);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Generic modal shell: overlay + dialog, focus management, Esc/backdrop */
/* ------------------------------------------------------------------ */

function focusables(dialog) {
  return Array.from(
    dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
  ).filter((n) => n.tabIndex !== -1);
}

function openModal(root, { titleId } = {}) {
  const overlay = el('div', 'tc-modal');
  const dialog = el('div', 'tc-modal__dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (titleId) dialog.setAttribute('aria-labelledby', titleId);
  overlay.appendChild(dialog);
  root.appendChild(overlay);

  const previouslyFocused = document.activeElement;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const list = focusables(dialog);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { overlay, dialog, close };
}

function focusFirst(dialog, preferred) {
  if (preferred && !preferred.disabled) {
    preferred.focus();
    return;
  }
  const list = focusables(dialog);
  if (list.length) list[0].focus();
  else dialog.focus();
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const CHIP_STATES = {
  readonly: { cls: 'tc-chip--readonly', text: 'read-only' },
  editing: { cls: 'tc-chip--editing', text: 'editing' },
  saving: { cls: 'tc-chip--saving', text: 'saving…' },
  error: { cls: 'tc-chip--error', text: 'error' },
};

/* ------------------------------------------------------------------ */
/* Month / year quick-picker (opens from the date label)               */
/* ------------------------------------------------------------------ */

let activePicker = null;

function closeMonthPicker() {
  if (activePicker) {
    if (activePicker._cleanup) activePicker._cleanup();
    activePicker.remove();
    activePicker = null;
  }
}

function openMonthPicker(anchor, curYear, curMonth, onJump) {
  closeMonthPicker();
  const today = new Date();
  let viewYear = curYear;
  let mode = 'month';

  const pop = el('div', 'tc-picker');
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Pick month and year');
  document.body.appendChild(pop);

  function position() {
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth || 220;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${left}px`;
  }

  function render() {
    pop.textContent = '';
    const head = el('div', 'tc-picker__head');
    const prev = el('button', 'tc-btn tc-btn--icon', '‹');
    const next = el('button', 'tc-btn tc-btn--icon', '›');
    const heading = el('button', 'tc-picker__heading', '');
    [prev, next, heading].forEach((b) => (b.type = 'button'));
    prev.setAttribute('aria-label', 'Previous');
    next.setAttribute('aria-label', 'Next');
    head.append(prev, heading, next);
    const grid = el('div', 'tc-picker__grid');
    pop.append(head, grid);

    if (mode === 'month') {
      heading.textContent = String(viewYear);
      heading.title = 'Pick a year';
      heading.addEventListener('click', () => { mode = 'year'; render(); });
      prev.addEventListener('click', () => { viewYear -= 1; render(); });
      next.addEventListener('click', () => { viewYear += 1; render(); });
      MONTHS.forEach((name, i) => {
        const cell = el('button', 'tc-picker__cell', name.slice(0, 3));
        cell.type = 'button';
        if (viewYear === today.getFullYear() && i === today.getMonth()) cell.classList.add('tc-picker__cell--current');
        if (viewYear === curYear && i === curMonth) cell.classList.add('tc-picker__cell--selected');
        cell.addEventListener('click', () => { onJump(viewYear, i); closeMonthPicker(); });
        grid.append(cell);
      });
    } else {
      const base = viewYear - 5;
      heading.textContent = `${base}–${base + 11}`;
      heading.title = 'Back to months';
      heading.addEventListener('click', () => { mode = 'month'; render(); });
      prev.addEventListener('click', () => { viewYear -= 12; render(); });
      next.addEventListener('click', () => { viewYear += 12; render(); });
      for (let y = base; y < base + 12; y++) {
        const cell = el('button', 'tc-picker__cell', String(y));
        cell.type = 'button';
        if (y === today.getFullYear()) cell.classList.add('tc-picker__cell--current');
        if (y === curYear) cell.classList.add('tc-picker__cell--selected');
        cell.addEventListener('click', () => { viewYear = y; mode = 'month'; render(); });
        grid.append(cell);
      }
    }
    position();
  }

  render();

  function onDocDown(e) {
    if (!pop.contains(e.target) && e.target !== anchor) closeMonthPicker();
  }
  function onKey(e) { if (e.key === 'Escape') { closeMonthPicker(); anchor.focus(); } }
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', position);
  }, 0);
  pop._cleanup = () => {
    document.removeEventListener('mousedown', onDocDown);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', position);
  };
  activePicker = pop;
}

export function mountHeader(root, opts = {}) {
  const { onPrev, onNext, onToday, onToggleView, onToggleTheme, onEditToken, onSearch, onJump } = opts;

  root.innerHTML = '';
  const header = el('div', 'tc-header');

  const brand = el('div', 'tc-header__brand');
  brand.appendChild(el('div', 'tc-header__title', 'Team Calendar'));
  const statusEl = el('button', 'tc-header__status', '');
  statusEl.type = 'button';
  statusEl.setAttribute('aria-label', 'Access status — click to add or change your token');
  statusEl.addEventListener('click', () => onEditToken && onEditToken());
  brand.appendChild(statusEl);

  const nav = el('div', 'tc-header__nav');
  const prevBtn = el('button', 'tc-btn tc-btn--icon', '‹');
  prevBtn.type = 'button';
  prevBtn.setAttribute('aria-label', 'Previous period');
  prevBtn.addEventListener('click', () => onPrev && onPrev());

  const todayBtn = el('button', 'tc-btn', 'Today');
  todayBtn.type = 'button';
  todayBtn.addEventListener('click', () => onToday && onToday());

  const nextBtn = el('button', 'tc-btn tc-btn--icon', '›');
  nextBtn.type = 'button';
  nextBtn.setAttribute('aria-label', 'Next period');
  nextBtn.addEventListener('click', () => onNext && onNext());

  let curYear = new Date().getFullYear();
  let curMonth = new Date().getMonth();
  const label = el('button', 'tc-header__label', '');
  label.type = 'button';
  label.setAttribute('aria-label', 'Pick month and year');
  label.addEventListener('click', () => openMonthPicker(label, curYear, curMonth, (y, m) => onJump && onJump(y, m)));
  nav.append(prevBtn, todayBtn, nextBtn, label);

  const viewGroup = el('div', 'tc-header__group');
  const monthBtn = el('button', 'tc-btn', 'Month');
  monthBtn.type = 'button';
  monthBtn.dataset.view = 'month';
  monthBtn.addEventListener('click', () => onToggleView && onToggleView('month'));

  const agendaBtn = el('button', 'tc-btn', 'Agenda');
  agendaBtn.type = 'button';
  agendaBtn.dataset.view = 'agenda';
  agendaBtn.addEventListener('click', () => onToggleView && onToggleView('agenda'));
  viewGroup.append(monthBtn, agendaBtn);

  const searchGroup = el('div', 'tc-header__group tc-header__search');
  const searchInput = el('input', 'tc-search');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search events…';
  searchInput.setAttribute('aria-label', 'Search events');
  searchInput.addEventListener('input', () => onSearch && onSearch(searchInput.value));
  searchGroup.appendChild(searchInput);

  const rightGroup = el('div', 'tc-header__group');
  const themeBtn = el('button', 'tc-btn tc-btn--theme', '');
  themeBtn.type = 'button';
  themeBtn.addEventListener('click', () => onToggleTheme && onToggleTheme());
  rightGroup.append(themeBtn);

  header.append(brand, nav, searchGroup, viewGroup, rightGroup);
  root.appendChild(header);

  function setPeriod(year, month) {
    curYear = year;
    curMonth = month;
    label.textContent = monthLabel(year, month);
  }

  function setChip(state) {
    const key = String(state || '').toLowerCase().replace(/[^a-z]/g, '');
    const entry = CHIP_STATES[key] || CHIP_STATES.readonly;
    statusEl.className = 'tc-header__status tc-header__status--' + key;
    statusEl.textContent = entry.text;
  }

  function setView(name) {
    monthBtn.classList.toggle('tc-btn--active', name === 'month');
    agendaBtn.classList.toggle('tc-btn--active', name === 'agenda');
  }

  function effectiveTheme() {
    return (
      document.documentElement.dataset.theme ||
      (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark')
    );
  }

  function setTheme(name) {
    const theme = name || effectiveTheme();
    themeBtn.textContent = theme;
    themeBtn.setAttribute('aria-label', `Theme: ${theme} (click to change)`);
    themeBtn.title = `Theme: ${theme}`;
  }

  setChip('readonly');
  setView('month');
  setTheme();

  return { setPeriod, setChip, setView, setTheme };
}

/* ------------------------------------------------------------------ */
/* Event modal                                                         */
/* ------------------------------------------------------------------ */

export function openEventModal(root, opts = {}) {
  const { model, event, dateISO, onSave, onDelete, canEdit, onManageTemplates } = opts;
  const isEdit = !!(event && event.id);
  const editable = canEdit !== false;

  const titleId = 'tc-event-modal-title';
  const header = el('div', 'tc-modal__header');
  const titleEl = el('h2', 'tc-modal__title', isEdit ? (editable ? 'Edit Event' : 'View Event') : 'Add Event');
  titleEl.id = titleId;
  header.appendChild(titleEl);
  const closeBtn = el('button', 'tc-btn tc-btn--icon', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  header.appendChild(closeBtn);

  const form = el('form', 'tc-modal__form');

  const titleInput = el('input');
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.value = (event && event.title) || '';
  titleInput.disabled = !editable;

  const dateInput = el('input');
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.value = (event && event.date) || dateISO || '';
  dateInput.disabled = !editable;

  const allDayInput = el('input');
  allDayInput.type = 'checkbox';
  allDayInput.checked = !!(event && event.allDay);
  allDayInput.disabled = !editable;

  const startInput = el('input');
  startInput.type = 'time';
  startInput.value = (event && event.start) || '';

  const endInput = el('input');
  endInput.type = 'time';
  endInput.value = (event && event.end) || '';

  const catSelect = el('select');
  const noneOpt = el('option', null, 'No category');
  noneOpt.value = '';
  catSelect.appendChild(noneOpt);
  for (const c of (model && model.categories) || []) {
    const opt = el('option', null, c.label || c.id);
    opt.value = c.id;
    opt.style.color = categoryColor(model, c.id);
    catSelect.appendChild(opt);
  }
  catSelect.value = (event && event.category) || '';
  catSelect.disabled = !editable;

  const descArea = el('textarea');
  descArea.value = (event && event.description) || '';
  descArea.rows = 3;
  descArea.disabled = !editable;

  const titleField = field('Title', titleInput);
  const dateField = field('Date', dateInput);

  const allDayField = el('div', 'tc-modal__field tc-modal__field--inline');
  const allDayLabel = el('label', null, 'All-day');
  const allDayId = 'tc-field-allday-' + Math.random().toString(36).slice(2, 7);
  allDayInput.id = allDayId;
  allDayLabel.htmlFor = allDayId;
  allDayField.append(allDayInput, allDayLabel);

  const startField = field('Start', startInput);
  const endField = field('End', endInput);
  const catField = field('Category', catSelect);
  const descField = field('Description', descArea);

  function syncAllDay() {
    const hide = allDayInput.checked;
    startField.hidden = hide;
    endField.hidden = hide;
    startInput.disabled = hide || !editable;
    endInput.disabled = hide || !editable;
  }
  allDayInput.addEventListener('change', syncAllDay);
  syncAllDay();

  catSelect.addEventListener('change', () => {
    catSelect.style.color = catSelect.value ? categoryColor(model, catSelect.value) : '';
  });
  catSelect.style.color = catSelect.value ? categoryColor(model, catSelect.value) : '';

  function applyTemplate(t) {
    titleInput.value = t.title || '';
    catSelect.value = t.category || '';
    catSelect.style.color = catSelect.value ? categoryColor(model, catSelect.value) : '';
    allDayInput.checked = !!t.allDay;
    startInput.value = t.start || '';
    endInput.value = t.end || '';
    descArea.value = t.description || '';
    syncAllDay();
  }

  // "Start from template" — only when creating a new event and able to edit.
  let templateField = null;
  if (!isEdit && editable) {
    const tplSelect = el('select');
    const blank = el('option', null, 'Blank event');
    blank.value = '';
    tplSelect.appendChild(blank);
    for (const t of (model && model.templates) || []) {
      const opt = el('option', null, t.name);
      opt.value = t.id;
      tplSelect.appendChild(opt);
    }
    const manageOpt = el('option', null, 'Manage templates…');
    manageOpt.value = '__manage__';
    tplSelect.appendChild(manageOpt);
    tplSelect.addEventListener('change', () => {
      if (tplSelect.value === '__manage__') {
        tplSelect.value = '';
        onManageTemplates && onManageTemplates();
        return;
      }
      const t = ((model && model.templates) || []).find((x) => x.id === tplSelect.value);
      if (t) applyTemplate(t);
    });
    templateField = field('Start from template', tplSelect);
  }

  if (templateField) form.append(templateField);
  form.append(titleField, dateField, allDayField, startField, endField, catField, descField);

  const footer = el('div', 'tc-modal__footer' + (isEdit && editable ? ' tc-modal__footer--split' : ''));
  let deleteBtn = null;
  if (isEdit && editable) {
    deleteBtn = el('button', 'tc-btn tc-btn--danger', 'Delete');
    deleteBtn.type = 'button';
    footer.appendChild(deleteBtn);
  }

  const rightBtns = el('div', 'tc-header__group');
  const cancelBtn = el('button', 'tc-btn', 'Cancel');
  cancelBtn.type = 'button';
  rightBtns.appendChild(cancelBtn);

  let saveBtn = null;
  if (editable) {
    saveBtn = el('button', 'tc-btn tc-btn--primary', 'Save');
    saveBtn.type = 'submit';
    rightBtns.appendChild(saveBtn);
  }
  footer.appendChild(rightBtns);
  form.appendChild(footer);

  const { dialog, close } = openModal(root, { titleId });
  dialog.append(header, form);

  cancelBtn.addEventListener('click', () => close());
  closeBtn.addEventListener('click', () => close());

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      onDelete && onDelete(event.id);
      close();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editable) return;
    if (!form.reportValidity()) return;
    const allDay = allDayInput.checked;
    const input = {
      title: titleInput.value.trim(),
      date: dateInput.value,
      allDay,
      start: allDay ? null : (startInput.value || null),
      end: allDay ? null : (endInput.value || null),
      category: catSelect.value || null,
      description: descArea.value,
    };
    onSave && onSave(input);
    close();
  });

  focusFirst(dialog, editable ? titleInput : null);

  return { close };
}

/* ------------------------------------------------------------------ */
/* Template manager modal                                              */
/* ------------------------------------------------------------------ */

export function openTemplateManager(root, opts = {}) {
  const { getModel, onSave, onDelete } = opts;
  const titleId = 'tc-tpl-modal-title';

  const header = el('div', 'tc-modal__header');
  const titleEl = el('h2', 'tc-modal__title', 'Templates');
  titleEl.id = titleId;
  header.appendChild(titleEl);
  const closeBtn = el('button', 'tc-btn tc-btn--icon', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  header.appendChild(closeBtn);

  const body = el('div', 'tc-modal__form');
  const listEl = el('div', 'tc-tpl-list');

  const nameInput = el('input'); nameInput.type = 'text'; nameInput.required = true;
  const titleInput = el('input'); titleInput.type = 'text';
  const catSelect = el('select');
  const allDayInput = el('input'); allDayInput.type = 'checkbox';
  const startInput = el('input'); startInput.type = 'time';
  const endInput = el('input'); endInput.type = 'time';
  const descArea = el('textarea'); descArea.rows = 2;

  const startField = field('Start', startInput);
  const endField = field('End', endInput);
  const allDayField = el('div', 'tc-modal__field tc-modal__field--inline');
  const allDayId = 'tc-tplfield-allday-' + Math.random().toString(36).slice(2, 7);
  allDayInput.id = allDayId;
  const allDayLabel = el('label', null, 'All-day'); allDayLabel.htmlFor = allDayId;
  allDayField.append(allDayInput, allDayLabel);

  function syncAllDay() {
    const hide = allDayInput.checked;
    startField.hidden = hide;
    endField.hidden = hide;
  }
  allDayInput.addEventListener('change', syncAllDay);

  const form = el('form', 'tc-tpl-form');
  form.append(
    field('Template name', nameInput),
    field('Default title', titleInput),
    allDayField, startField, endField,
    field('Category', catSelect),
    field('Description', descArea),
  );
  const formFooter = el('div', 'tc-modal__footer tc-modal__footer--split');
  const cancelEditBtn = el('button', 'tc-btn', 'Cancel edit');
  cancelEditBtn.type = 'button';
  const saveTplBtn = el('button', 'tc-btn tc-btn--primary', 'Add template');
  saveTplBtn.type = 'submit';
  formFooter.append(cancelEditBtn, saveTplBtn);
  form.appendChild(formFooter);

  body.append(listEl, el('div', 'tc-tpl-sep'), form);

  const { dialog, close } = openModal(root, { titleId });
  dialog.append(header, body);
  closeBtn.addEventListener('click', () => close());

  let editingId = null;

  function renderCategoryOptions() {
    const keep = catSelect.value;
    catSelect.textContent = '';
    const none = el('option', null, 'No category'); none.value = '';
    catSelect.appendChild(none);
    for (const c of (getModel().categories || [])) {
      const o = el('option', null, c.label || c.id); o.value = c.id;
      catSelect.appendChild(o);
    }
    catSelect.value = keep;
  }

  function resetForm() {
    editingId = null;
    nameInput.value = ''; titleInput.value = ''; catSelect.value = '';
    allDayInput.checked = true; startInput.value = ''; endInput.value = ''; descArea.value = '';
    syncAllDay();
    saveTplBtn.textContent = 'Add template';
    cancelEditBtn.hidden = true;
  }

  function loadForEdit(t) {
    editingId = t.id;
    nameInput.value = t.name; titleInput.value = t.title || ''; catSelect.value = t.category || '';
    allDayInput.checked = !!t.allDay; startInput.value = t.start || ''; endInput.value = t.end || '';
    descArea.value = t.description || '';
    syncAllDay();
    saveTplBtn.textContent = 'Save changes';
    cancelEditBtn.hidden = false;
    nameInput.focus();
  }

  function renderList() {
    listEl.textContent = '';
    const templates = getModel().templates || [];
    if (!templates.length) {
      listEl.appendChild(el('div', 'tc-tpl-empty', 'No templates yet — create one below.'));
      return;
    }
    for (const t of templates) {
      const row = el('div', 'tc-tpl-row');
      const name = el('button', 'tc-tpl-row__name', t.name); name.type = 'button';
      name.addEventListener('click', () => loadForEdit(t));
      const del = el('button', 'tc-btn tc-btn--danger tc-btn--icon', '×');
      del.type = 'button'; del.setAttribute('aria-label', 'Delete ' + t.name);
      del.addEventListener('click', () => {
        Promise.resolve(onDelete && onDelete(t.id)).then(() => {
          if (editingId === t.id) resetForm();
          renderList();
        });
      });
      row.append(name, del);
      listEl.appendChild(row);
    }
  }

  cancelEditBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const allDay = allDayInput.checked;
    const input = {
      name: nameInput.value.trim(),
      title: titleInput.value.trim(),
      allDay,
      start: allDay ? null : (startInput.value || null),
      end: allDay ? null : (endInput.value || null),
      category: catSelect.value || null,
      description: descArea.value,
    };
    Promise.resolve(onSave && onSave(input, editingId)).then(() => {
      resetForm();
      renderCategoryOptions();
      renderList();
    });
  });

  renderCategoryOptions();
  renderList();
  resetForm();
  focusFirst(dialog, nameInput);
  return { close };
}

/* ------------------------------------------------------------------ */
/* Token modal                                                         */
/* ------------------------------------------------------------------ */

export function openTokenModal(root, opts = {}) {
  const { kind, origin, onSave } = opts;

  const titleId = 'tc-token-modal-title';
  const header = el('div', 'tc-modal__header');
  const titleEl = el('h2', 'tc-modal__title', 'Personal Access Token');
  titleEl.id = titleId;
  header.appendChild(titleEl);
  const closeBtn = el('button', 'tc-btn tc-btn--icon', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  header.appendChild(closeBtn);

  const explain = el(
    'p',
    'tc-modal__field',
    'To make edits, paste a personal access token with repo/API scope. It is stored only in this browser.'
  );

  const link = el('a', 'tc-btn tc-btn--primary', 'Create one now →');
  link.href = createTokenURL(kind, origin);
  link.target = '_blank';
  link.rel = 'noopener';

  const tokenInput = el('input');
  tokenInput.type = 'password';
  tokenInput.autocomplete = 'off';
  tokenInput.placeholder = 'Paste token here';
  const tokenField = field('Token', tokenInput);

  const footer = el('div', 'tc-modal__footer');
  const cancelBtn = el('button', 'tc-btn', 'Cancel');
  cancelBtn.type = 'button';
  const saveBtn = el('button', 'tc-btn tc-btn--primary', 'Save');
  saveBtn.type = 'button';
  footer.append(cancelBtn, saveBtn);

  const { dialog, close } = openModal(root, { titleId });
  dialog.append(header, explain, link, tokenField, footer);

  closeBtn.addEventListener('click', () => close());
  cancelBtn.addEventListener('click', () => close());

  function submit() {
    const val = tokenInput.value.trim();
    if (!val) {
      tokenInput.focus();
      return;
    }
    onSave && onSave(val);
    close();
  }
  saveBtn.addEventListener('click', submit);
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  focusFirst(dialog, tokenInput);

  return { close };
}

/* ------------------------------------------------------------------ */
/* Theme                                                                */
/* ------------------------------------------------------------------ */

export function setTheme(name) {
  if (name) {
    document.documentElement.dataset.theme = name;
    try {
      localStorage.setItem(THEME_KEY, name);
    } catch {
      /* localStorage unavailable (e.g. privacy mode) — ignore */
    }
  } else {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.removeItem(THEME_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }
  if (saved) {
    document.documentElement.dataset.theme = saved;
  }
  // If nothing saved, leave data-theme unset so the
  // prefers-color-scheme media query in theme.css governs.
}
