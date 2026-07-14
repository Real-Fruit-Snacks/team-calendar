export function emptyModel() {
  return { version: 1, categories: [], templates: [], events: [] };
}

export function makeId(rand = Math.random) {
  return 'evt_' + rand().toString(36).slice(2, 8).padEnd(6, '0');
}

export function validateEvent(input) {
  const errors = [];
  if (!input || !input.title || !String(input.title).trim()) errors.push('title required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input && input.date || '')) errors.push('valid date required');
  if (input && !input.allDay) {
    if (input.start && !/^\d{2}:\d{2}$/.test(input.start)) errors.push('start must be HH:MM');
    if (input.end && !/^\d{2}:\d{2}$/.test(input.end)) errors.push('end must be HH:MM');
  }
  return errors;
}

function normalize(input, id) {
  const allDay = !!input.allDay;
  return {
    id,
    title: String(input.title).trim(),
    date: input.date,
    allDay,
    start: allDay ? null : (input.start || null),
    end: allDay ? null : (input.end || null),
    category: input.category || null,
    description: input.description || '',
  };
}

export function addEvent(model, input, idGen = makeId) {
  const errors = validateEvent(input);
  if (errors.length) throw new Error(errors.join('; '));
  return { ...model, events: [...model.events, normalize(input, idGen())] };
}

export function updateEvent(model, id, patch) {
  return {
    ...model,
    events: model.events.map(e => {
      if (e.id !== id) return e;
      const merged = { ...e, ...patch };
      if (merged.allDay) { merged.start = null; merged.end = null; }
      return merged;
    }),
  };
}

export function removeEvent(model, id) {
  return { ...model, events: model.events.filter(e => e.id !== id) };
}

function byTime(a, b) {
  if (a.allDay && !b.allDay) return -1;
  if (!a.allDay && b.allDay) return 1;
  const as = a.start || '', bs = b.start || '';
  return as < bs ? -1 : as > bs ? 1 : 0;
}

export function eventsForDate(model, iso) {
  return model.events.filter(e => e.date === iso).sort(byTime);
}

export function agenda(model, fromISO) {
  return model.events
    .filter(e => e.date >= fromISO)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b)));
}

/* ---------------- Templates (presets for new events) ---------------- */

export function makeTemplateId(rand = Math.random) {
  return 'tpl_' + rand().toString(36).slice(2, 8).padEnd(6, '0');
}

export function validateTemplate(input) {
  const errors = [];
  if (!input || !input.name || !String(input.name).trim()) errors.push('name required');
  if (input && !input.allDay) {
    if (input.start && !/^\d{2}:\d{2}$/.test(input.start)) errors.push('start must be HH:MM');
    if (input.end && !/^\d{2}:\d{2}$/.test(input.end)) errors.push('end must be HH:MM');
  }
  return errors;
}

function normalizeTemplate(input, id) {
  const allDay = !!input.allDay;
  return {
    id,
    name: String(input.name).trim(),
    title: input.title ? String(input.title).trim() : '',
    allDay,
    start: allDay ? null : (input.start || null),
    end: allDay ? null : (input.end || null),
    category: input.category || null,
    description: input.description || '',
  };
}

export function addTemplate(model, input, idGen = makeTemplateId) {
  const errors = validateTemplate(input);
  if (errors.length) throw new Error(errors.join('; '));
  const templates = model.templates || [];
  return { ...model, templates: [...templates, normalizeTemplate(input, idGen())] };
}

export function updateTemplate(model, id, patch) {
  const templates = model.templates || [];
  return {
    ...model,
    templates: templates.map(t => {
      if (t.id !== id) return t;
      const merged = { ...t, ...patch };
      if (merged.allDay) { merged.start = null; merged.end = null; }
      return merged;
    }),
  };
}

export function removeTemplate(model, id) {
  return { ...model, templates: (model.templates || []).filter(t => t.id !== id) };
}

// Case-insensitive substring match across title, description, and category label.
// An empty query matches everything.
export function eventMatches(model, event, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const cat = (model.categories || []).find(c => c.id === event.category);
  const haystack = [event.title, event.description, cat && cat.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}
