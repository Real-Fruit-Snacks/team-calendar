import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryColor } from '../assets/js/render.js';

const model = {
  categories: [
    { id: 'deploy', label: 'Deploy', color: '#e5534b' },
    { id: 'evil', label: 'Evil', color: 'url(https://evil.example/beacon)' },
    { id: 'short', label: 'Short', color: '#abc' },
  ],
};

test('categoryColor returns a valid hex color', () => {
  assert.equal(categoryColor(model, 'deploy'), '#e5534b');
  assert.equal(categoryColor(model, 'short'), '#abc');
});

test('categoryColor rejects non-hex values (no url()/injection) and falls back', () => {
  assert.equal(categoryColor(model, 'evil'), 'var(--tc-text-dim)');
});

test('categoryColor falls back for unknown or missing category', () => {
  assert.equal(categoryColor(model, 'nope'), 'var(--tc-text-dim)');
  assert.equal(categoryColor({}, 'deploy'), 'var(--tc-text-dim)');
});
