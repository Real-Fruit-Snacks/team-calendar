import test from 'node:test';
import assert from 'node:assert/strict';
import { toISO, todayISO, monthGrid, monthLabel, addMonths } from '../assets/js/dates.js';

test('toISO zero-pads month and day', () => {
  assert.equal(toISO(2026, 6, 1), '2026-07-01'); // month index 6 = July
});

test('monthGrid returns 6 weeks of 7 days', () => {
  const grid = monthGrid(2026, 6);
  assert.equal(grid.length, 6);
  for (const week of grid) assert.equal(week.length, 7);
});

test('monthGrid marks in-month cells and includes month boundaries', () => {
  const grid = monthGrid(2026, 6).flat();
  const first = grid.find(c => c.iso === '2026-07-01');
  const last = grid.find(c => c.iso === '2026-07-31');
  assert.ok(first && first.inMonth && first.day === 1);
  assert.ok(last && last.inMonth && last.day === 31);
  const leading = grid.find(c => c.iso === '2026-06-30');
  assert.ok(leading && leading.inMonth === false);
});

test('monthLabel formats human month', () => {
  assert.equal(monthLabel(2026, 6), 'July 2026');
});

test('addMonths wraps across year boundary', () => {
  assert.deepEqual(addMonths(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(addMonths(2026, 0, -1), { year: 2025, month: 11 });
});

test('todayISO uses injected date', () => {
  assert.equal(todayISO(new Date(2026, 6, 4)), '2026-07-04');
});
