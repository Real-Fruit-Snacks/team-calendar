import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyModel, validateEvent, addEvent, updateEvent, removeEvent,
  eventsForDate, agenda, eventMatches,
  validateTemplate, addTemplate, updateTemplate, removeTemplate,
  validateFieldDef, snapshotTemplateFields,
} from '../assets/js/model.js';

const seq = () => { let i = 0; return () => `evt_${i++}`; };

test('validateEvent flags missing title and bad date', () => {
  const errs = validateEvent({ title: '', date: 'nope', allDay: true });
  assert.ok(errs.includes('title required'));
  assert.ok(errs.includes('valid date required'));
});

test('validateEvent rejects malformed time on timed event', () => {
  const errs = validateEvent({ title: 'x', date: '2026-07-01', allDay: false, start: '9am' });
  assert.ok(errs.some(e => e.includes('start')));
});

test('addEvent appends a normalized event', () => {
  const m = addEvent(emptyModel(), { title: ' Release ', date: '2026-07-20', allDay: true }, seq());
  assert.equal(m.events.length, 1);
  assert.equal(m.events[0].title, 'Release');
  assert.equal(m.events[0].id, 'evt_0');
  assert.equal(m.events[0].start, null);
});

test('addEvent throws on invalid input', () => {
  assert.throws(() => addEvent(emptyModel(), { title: '', date: 'x' }));
});

test('updateEvent clears times when switched to all-day', () => {
  let m = addEvent(emptyModel(), { title: 'M', date: '2026-07-01', allDay: false, start: '14:00' }, seq());
  m = updateEvent(m, 'evt_0', { allDay: true });
  assert.equal(m.events[0].start, null);
  assert.equal(m.events[0].end, null);
});

test('removeEvent drops by id', () => {
  let m = addEvent(emptyModel(), { title: 'M', date: '2026-07-01', allDay: true }, seq());
  m = removeEvent(m, 'evt_0');
  assert.equal(m.events.length, 0);
});

test('eventsForDate sorts all-day before timed', () => {
  let m = emptyModel();
  m = addEvent(m, { title: 'Timed', date: '2026-07-01', allDay: false, start: '09:00' }, seq());
  m = addEvent(m, { title: 'AllDay', date: '2026-07-01', allDay: true }, () => 'evt_z');
  const list = eventsForDate(m, '2026-07-01');
  assert.equal(list[0].title, 'AllDay');
  assert.equal(list[1].title, 'Timed');
});

test('agenda returns future events in date then time order', () => {
  let m = emptyModel();
  m = addEvent(m, { title: 'B', date: '2026-07-05', allDay: true }, () => 'a');
  m = addEvent(m, { title: 'A', date: '2026-07-02', allDay: true }, () => 'b');
  m = addEvent(m, { title: 'Past', date: '2026-06-01', allDay: true }, () => 'c');
  const list = agenda(m, '2026-07-01');
  assert.deepEqual(list.map(e => e.title), ['A', 'B']);
});

test('eventMatches: empty query matches everything', () => {
  const m = { categories: [], events: [] };
  assert.equal(eventMatches(m, { title: 'Anything' }, ''), true);
  assert.equal(eventMatches(m, { title: 'Anything' }, '   '), true);
});

test('eventMatches: matches title, description, and category label (case-insensitive)', () => {
  const m = { categories: [{ id: 'deploy', label: 'Deploy', color: '#e5534b' }], events: [] };
  const ev = { title: 'Release 2.4', description: 'Cut the branch', category: 'deploy' };
  assert.equal(eventMatches(m, ev, 'release'), true);   // title
  assert.equal(eventMatches(m, ev, 'BRANCH'), true);    // description, case-insensitive
  assert.equal(eventMatches(m, ev, 'deploy'), true);    // category label
  assert.equal(eventMatches(m, ev, 'meeting'), false);  // no match
});

test('eventMatches: tolerates missing description/category', () => {
  const m = { categories: [], events: [] };
  const ev = { title: 'Standup', description: '', category: null };
  assert.equal(eventMatches(m, ev, 'stand'), true);
  assert.equal(eventMatches(m, ev, 'xyz'), false);
});

test('validateTemplate requires a name', () => {
  assert.ok(validateTemplate({ name: '' }).includes('name required'));
  assert.deepEqual(validateTemplate({ name: 'Deploy', allDay: true }), []);
});

test('addTemplate appends a normalized template and requires a name', () => {
  let m = emptyModel();
  m = addTemplate(m, { name: ' Deploy ', category: 'deploy', allDay: true, description: 'Cut branch' }, seq());
  assert.equal(m.templates.length, 1);
  assert.equal(m.templates[0].name, 'Deploy');
  assert.equal(m.templates[0].id, 'evt_0');
  assert.equal(m.templates[0].start, null);
  assert.throws(() => addTemplate(m, { name: '' }));
});

test('addTemplate tolerates a model with no templates key', () => {
  const m = addTemplate({ version: 1, categories: [], events: [] }, { name: 'X' }, () => 't1');
  assert.deepEqual(m.templates.map(t => t.name), ['X']);
});

test('updateTemplate clears times when switched to all-day', () => {
  let m = addTemplate(emptyModel(), { name: 'M', allDay: false, start: '09:00' }, () => 't1');
  m = updateTemplate(m, 't1', { allDay: true });
  assert.equal(m.templates[0].start, null);
  assert.equal(m.templates[0].end, null);
});

test('removeTemplate drops by id', () => {
  let m = addTemplate(emptyModel(), { name: 'M' }, () => 't1');
  m = removeTemplate(m, 't1');
  assert.equal(m.templates.length, 0);
});

test('validateFieldDef: label required, valid type, dropdown needs options', () => {
  assert.ok(validateFieldDef({ label: '', type: 'text' }).includes('field label required'));
  assert.ok(validateFieldDef({ label: 'X', type: 'bogus' }).includes('invalid field type'));
  assert.ok(validateFieldDef({ label: 'P', type: 'select', options: [] }).some(e => /option/.test(e)));
  assert.deepEqual(validateFieldDef({ label: 'P', type: 'select', options: ['Low'] }), []);
  assert.deepEqual(validateFieldDef({ label: 'Loc', type: 'text' }), []);
});

test('addTemplate normalizes field definitions (assigns ids, filters options)', () => {
  let m = emptyModel();
  m = addTemplate(m, {
    name: 'Deploy',
    fields: [
      { label: 'Version', type: 'text', default: '1.0' },
      { label: 'Priority', type: 'select', options: ['Low', ' ', 'High'], default: 'Low' },
    ],
  }, () => 't1');
  const f = m.templates[0].fields;
  assert.equal(f.length, 2);
  assert.ok(f[0].id.startsWith('fld_'));
  assert.equal(f[0].default, '1.0');
  assert.deepEqual(f[1].options, ['Low', 'High']);
});

test('addTemplate rejects a dropdown field with no options', () => {
  assert.throws(() => addTemplate(emptyModel(), {
    name: 'Bad', fields: [{ label: 'P', type: 'select', options: [] }],
  }));
});

test('snapshotTemplateFields turns defs into event field values using defaults', () => {
  const tpl = { fields: [
    { id: 'f1', label: 'Version', type: 'text', default: '2.4' },
    { id: 'f2', label: 'Priority', type: 'select', options: ['Low', 'High'], default: 'High' },
  ] };
  const snap = snapshotTemplateFields(tpl);
  assert.deepEqual(snap[0], { id: 'f1', label: 'Version', type: 'text', value: '2.4' });
  assert.deepEqual(snap[1], { id: 'f2', label: 'Priority', type: 'select', value: 'High', options: ['Low', 'High'] });
});

test('addEvent carries custom fields; blank events omit the fields key', () => {
  let m = emptyModel();
  m = addEvent(m, {
    title: 'Deploy 2.4', date: '2026-07-20', allDay: true,
    fields: [{ id: 'f1', label: 'Version', type: 'text', value: '2.4' }],
  }, () => 'e1');
  assert.deepEqual(m.events[0].fields, [{ id: 'f1', label: 'Version', type: 'text', value: '2.4' }]);
  m = addEvent(m, { title: 'Plain', date: '2026-07-21', allDay: true }, () => 'e2');
  assert.ok(!('fields' in m.events[1]));
});

test('eventMatches searches custom field labels and values', () => {
  const m = { categories: [], events: [] };
  const ev = { title: 'Deploy', fields: [{ id: 'f1', label: 'Version', type: 'text', value: '2.4-rc1' }] };
  assert.equal(eventMatches(m, ev, '2.4-rc1'), true);
  assert.equal(eventMatches(m, ev, 'version'), true);
  assert.equal(eventMatches(m, ev, 'nope'), false);
});
