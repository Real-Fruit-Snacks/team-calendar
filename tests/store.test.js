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

function fakeFetch(model) {
  return async () => ({ ok: true, status: 200, text: async () => JSON.stringify(model) });
}

test('load reads events.json as a static file via fetchImpl, not the host API', async () => {
  const host = fakeHost(emptyModel());
  let getFileCalls = 0;
  host.getFile = async () => { getFileCalls++; return { content: JSON.stringify(emptyModel()), ref: 'r0' }; };
  const model = addEvent(emptyModel(), { title: 'X', date: '2026-07-01', allDay: true }, () => 'e1');
  let fetchedUrl;
  const fetchImpl = async (url, opts) => {
    fetchedUrl = url;
    assert.equal(opts.cache, 'no-store');
    return { ok: true, status: 200, text: async () => JSON.stringify(model) };
  };
  const store = createStore({ host, fetchImpl });
  const m = await store.load('tok');
  assert.equal(m.events.length, 1);
  assert.deepEqual(store.get(), m);
  assert.match(fetchedUrl, /^events\.json\?t=\d+$/);
  assert.equal(getFileCalls, 0); // static read must not touch the API
});

test('load throws when fetchImpl reports a non-ok response', async () => {
  const host = fakeHost(emptyModel());
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
  const store = createStore({ host, fetchImpl });
  await assert.rejects(() => store.load('tok'), /load events\.json: 404/);
});

test('save applies mutator and persists, fetching a real ref via the API first', async () => {
  const host = fakeHost(emptyModel());
  let getFileCalls = 0;
  const origGetFile = host.getFile.bind(host);
  host.getFile = async (...args) => { getFileCalls++; return origGetFile(...args); };
  let putFileCalls = 0;
  const origPutFile = host.putFile.bind(host);
  host.putFile = async (...args) => { putFileCalls++; return origPutFile(...args); };
  const store = createStore({ host, fetchImpl: fakeFetch(emptyModel()) });
  await store.load('tok'); // static read: ref stays null
  const m = await store.save(model => addEvent(model, { title: 'X', date: '2026-07-01', allDay: true }, () => 'e1'), 'tok', 'Add event: X');
  assert.equal(m.events.length, 1);
  assert.equal(getFileCalls, 1); // lazily fetched a real commit ref before writing
  assert.equal(putFileCalls, 1);
});

test('save retries once on conflict, re-applying against fresh data', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host, fetchImpl: fakeFetch(emptyModel()) });
  await store.load('tok'); // static read: ref stays null
  // Simulate a teammate adding an event, and our first put failing as stale.
  host._setStored(addEvent(emptyModel(), { title: 'Theirs', date: '2026-07-02', allDay: true }, () => 'ext'));
  host._failNextPut();
  const m = await store.save(model => addEvent(model, { title: 'Mine', date: '2026-07-03', allDay: true }, () => 'mine'), 'tok', 'Add event: Mine');
  const titles = m.events.map(e => e.title).sort();
  assert.deepEqual(titles, ['Mine', 'Theirs']); // both survive — no clobber
});

test('save gives up after one retry', async () => {
  const host = fakeHost(emptyModel());
  const store = createStore({ host, fetchImpl: fakeFetch(emptyModel()) });
  await store.load('tok');
  host._failNextPut();
  // Make it fail again by overriding putFile to always conflict:
  host.putFile = async () => { const e = new Error('stale'); e.conflict = true; throw e; };
  await assert.rejects(() => store.save(m => m, 'tok', 'noop'));
});
