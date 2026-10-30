import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeAdaptiveDelayMs,
  PACING_LOW_REMAINING,
  PACING_MAX_RESET_WAIT_MS
} from './feed-utils.mjs';

test('adaptive pacing: unknown remaining uses base pause with jitter', () => {
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, random: () => 0 }),
    { delayMs: 800, deferUntil: null }
  );
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, random: () => 1 }),
    { delayMs: 1200, deferUntil: null }
  );
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: null, random: () => 0.5 }),
    { delayMs: 1000, deferUntil: null }
  );
});

test('adaptive pacing: low remaining quadruples the pause', () => {
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: 3, random: () => 0 }),
    { delayMs: 3200, deferUntil: null }
  );
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: 6, random: () => 0 }),
    { delayMs: 800, deferUntil: null }
  );
  assert.equal(PACING_LOW_REMAINING, 5);
});

test('adaptive pacing: exhausted quota with a near reset waits it out', () => {
  const nowMs = Date.parse('2026-10-30T00:00:00Z');
  const resetAt = new Date(nowMs + 2 * 60 * 1000).toISOString();
  const out = computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: 0, resetAt, nowMs, random: () => 0 });
  assert.equal(out.deferUntil, null);
  assert.equal(out.delayMs, 120000 + 800);
});

test('adaptive pacing: exhausted quota with a distant reset defers', () => {
  const nowMs = Date.parse('2026-10-30T00:00:00Z');
  const resetAt = new Date(nowMs + 30 * 60 * 1000).toISOString();
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: 0, resetAt, nowMs, random: () => 0 }),
    { delayMs: 0, deferUntil: resetAt }
  );
  assert.equal(PACING_MAX_RESET_WAIT_MS, 5 * 60 * 1000);
});

test('adaptive pacing: string remaining and missing reset fall back safely', () => {
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: '0', random: () => 0 }),
    { delayMs: 3200, deferUntil: null }
  );
  assert.deepEqual(
    computeAdaptiveDelayMs({ basePauseMs: 1000, remaining: 0, resetAt: null, random: () => 0 }),
    { delayMs: 3200, deferUntil: null }
  );
});
