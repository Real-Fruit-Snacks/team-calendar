import { emptyModel } from './model.js';

export function createStore({ host }) {
  let current = emptyModel();
  let ref = null;

  async function refetch(token) {
    const { content, ref: r } = await host.getFile('events.json', token);
    current = JSON.parse(content);
    ref = r;
    return current;
  }

  return {
    get() { return current; },
    async load(token) { return refetch(token); },
    async save(mutator, token, message) {
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
            await refetch(token); // reload teammate's changes, then loop re-applies mutator
            continue;
          }
          throw err;
        }
      }
    },
  };
}
