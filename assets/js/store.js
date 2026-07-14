import { emptyModel } from './model.js';

export function createStore({
  host,
  fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined,
  dataUrl = 'events.json',
}) {
  let current = emptyModel();
  let ref = null;

  // API-based fetch: only source of a real commit ref, needed before writes
  // (initial save, and after a conflict) so putFile can send a valid sha.
  async function apiRefetch(token) {
    const { content, ref: r } = await host.getFile('events.json', token);
    current = JSON.parse(content);
    ref = r;
    return current;
  }

  return {
    get() { return current; },
    async load(token) {
      const res = await fetchImpl(`${dataUrl}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`load ${dataUrl}: ${res.status}`);
      current = JSON.parse(await res.text());
      ref = null; // static read carries no commit ref
      return current;
    },
    async save(mutator, token, message) {
      if (ref === null) await apiRefetch(token);
      for (let attempt = 0; attempt <= 1; attempt++) {
        const next = mutator(current);
        try {
          const newRef = await host.putFile(
            'events.json',
            JSON.stringify(next, null, 2) + '\n',
            message, token, ref,
          );
          current = next;
          ref = newRef;
          return current;
        } catch (err) {
          if (err && err.conflict && attempt === 0) {
            await apiRefetch(token); // reload teammate's changes, then loop re-applies mutator
            continue;
          }
          throw err;
        }
      }
    },
  };
}
