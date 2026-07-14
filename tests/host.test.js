import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHost, githubRepo, encodeBase64, decodeBase64, createHost } from '../assets/js/host.js';

test('detectHost recognizes github.io, else gitlab', () => {
  assert.equal(detectHost({ hostname: 'acme.github.io' }), 'github');
  assert.equal(detectHost({ hostname: 'gitlab.internal.corp' }), 'gitlab');
});

test('githubRepo parses owner and repo from pages URL', () => {
  assert.deepEqual(
    githubRepo({ hostname: 'acme.github.io', pathname: '/team-calendar/' }),
    { owner: 'acme', repo: 'team-calendar' }
  );
});

test('base64 round-trips UTF-8', () => {
  const s = '{"t":"café ✓"}';
  assert.equal(decodeBase64(encodeBase64(s)), s);
});

test('github adapter getFile hits contents API and decodes', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ content: encodeBase64('{"x":1}'), sha: 'abc' }) };
  };
  const host = createHost({
    location: { hostname: 'acme.github.io', pathname: '/team-calendar/', origin: 'https://acme.github.io' },
    config: {}, fetchImpl,
  });
  const { content, ref } = await host.getFile('events.json', 'tok');
  assert.match(calls[0].url, /api\.github\.com\/repos\/acme\/team-calendar\/contents\/events\.json/);
  assert.equal(content, '{"x":1}');
  assert.equal(ref, 'abc');
});

test('github adapter putFile sends sha and base64, returns new sha', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.equal(body.sha, 'old');
    assert.equal(decodeBase64(body.content), 'DATA');
    assert.equal(body.message, 'msg');
    return { ok: true, status: 200, json: async () => ({ content: { sha: 'new' } }) };
  };
  const host = createHost({
    location: { hostname: 'acme.github.io', pathname: '/team-calendar/', origin: 'https://acme.github.io' },
    config: {}, fetchImpl,
  });
  const ref = await host.putFile('events.json', 'DATA', 'msg', 'tok', 'old');
  assert.equal(ref, 'new');
});

test('putFile flags conflict on 409', async () => {
  const fetchImpl = async () => ({ ok: false, status: 409, json: async () => ({ message: 'conflict' }) });
  const host = createHost({
    location: { hostname: 'acme.github.io', pathname: '/tc/', origin: 'https://acme.github.io' },
    config: {}, fetchImpl,
  });
  await assert.rejects(() => host.putFile('events.json', 'D', 'm', 't', 'old'), (e) => e.conflict === true);
});

test('gitlab adapter builds files API URL with encoded path and projectId', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => ({ content: encodeBase64('{}'), last_commit_id: 'lc1' }) };
  };
  const host = createHost({
    location: { hostname: 'gitlab.internal', origin: 'https://gitlab.internal' },
    config: { host: 'gitlab', projectId: '42', branch: 'main' }, fetchImpl,
  });
  const { ref } = await host.getFile('events.json', 'tok');
  assert.match(calls[0], /gitlab\.internal\/api\/v4\/projects\/42\/repository\/files\/events\.json\?ref=main/);
  assert.equal(ref, 'lc1');
});
