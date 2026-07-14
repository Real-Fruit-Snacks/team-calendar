// tests/store.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../assets/js/store.js';
import { emptyModel, addEvent } from '../assets/js/model.js';

function fakeHost(initial) {
  let stored = JSON.stringify(initial);
  let ref = 'r0';
  let failNextPut = false;
  return {
    _setStored(m) { stored = JSON.stringify(m); ref = 'r_ext'; },
    _failNextPut() { failNextPut = true; },
    async getFile() { return { content: stored, ref }; },
    async putFile(path, content, message, token, incomingRef) {
      if (failNextPut) {
        failNextPut = false;
        const e = new Error('stale'); e.conflict = true; throw e;
      }
      stored = content; ref = 'r_' + Math.random().toString(36).slice(2, 5);
      return ref;
    },
  };
}

test('load parses and caches the model', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host });
  const m = await store.load('tok');
  assert.equal(m.version, 1);
  assert.deepEqual(store.get(), m);
});

test('save applies mutator and persists', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host });
  await store.load('tok');
  const m = await store.save(model => addEvent(model, { title: 'X', date: '2026-07-01', allDay: true }, () => 'e1'), 'tok', 'Add event: X');
  assert.equal(m.events.length, 1);
});

test('save retries once on conflict, re-applying against fresh data', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host });
  await store.load('tok');
  // Simulate a teammate adding an event, and our first put failing as stale.
  host._setStored(addEvent(emptyModel(), { title: 'Theirs', date: '2026-07-02', allDay: true }, () => 'ext'));
  host._failNextPut();
  const m = await store.save(model => addEvent(model, { title: 'Mine', date: '2026-07-03', allDay: true }, () => 'mine'), 'tok', 'Add event: Mine');
  const titles = m.events.map(e => e.title).sort();
  assert.deepEqual(titles, ['Mine', 'Theirs']); // both survive — no clobber
});

test('save gives up after one retry', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host });
  await store.load('tok');
  host._failNextPut();
  // Make it fail again by overriding putFile to always conflict:
  host.putFile = async () => { const e = new Error('stale'); e.conflict = true; throw e; };
  await assert.rejects(() => store.save(m => m, 'tok', 'noop'));
});
