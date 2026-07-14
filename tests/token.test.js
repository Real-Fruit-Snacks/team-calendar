import test from 'node:test';
import assert from 'node:assert/strict';
import { saveToken, loadToken, clearToken, hasToken, createTokenURL } from '../assets/js/token.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}

test('token round-trips through storage', () => {
  const s = fakeStorage();
  assert.equal(hasToken(s), false);
  saveToken('glpat-xyz', s);
  assert.equal(loadToken(s), 'glpat-xyz');
  assert.equal(hasToken(s), true);
  clearToken(s);
  assert.equal(loadToken(s), null);
});

test('createTokenURL builds gitlab deep link with scopes', () => {
  const url = createTokenURL('gitlab', 'https://gitlab.internal');
  assert.match(url, /gitlab\.internal\/-\/user_settings\/personal_access_tokens\?name=Team%20Calendar&scopes=api/);
});

test('createTokenURL builds github deep link', () => {
  assert.match(createTokenURL('github', 'https://acme.github.io'), /github\.com\/settings\/tokens\/new/);
});
