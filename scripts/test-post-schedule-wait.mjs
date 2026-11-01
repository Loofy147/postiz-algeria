import assert from 'node:assert/strict';
import test from 'node:test';
import { waitUntilPostScheduled } from '../apps/orchestrator/src/workflows/post-workflows/post-schedule.wait.ts';

test('returns a queued post that is already due without waiting', async () => {
  const post = { state: 'QUEUE', publishDate: new Date(99_000) };
  let waits = 0;
  const result = await waitUntilPostScheduled({
    loadPost: async () => post,
    isPoked: () => false,
    consumePoke: () => assert.fail('no signal expected'),
    waitForPoke: async () => { waits += 1; return false; },
    now: () => 100_000,
  });

  assert.equal(result, post);
  assert.equal(waits, 0);
});

test('reloads a later schedule after a poke and waits for the new due time', async () => {
  let now = 100_000;
  let current = { state: 'QUEUE', publishDate: new Date(100_050) };
  let poked = false;
  const waits = [];

  const result = await waitUntilPostScheduled({
    loadPost: async () => current,
    isPoked: () => poked,
    consumePoke: () => { poked = false; },
    waitForPoke: async (timeoutMs) => {
      waits.push(timeoutMs);
      if (waits.length === 1) {
        current = { state: 'QUEUE', publishDate: new Date(200_000) };
        poked = true;
        return true;
      }
      now = 200_000;
      return false;
    },
    now: () => now,
  });

  assert.equal(result, current);
  assert.deepEqual(waits, [50, 100_000]);
});

test('stops when a poke finds the post has become a draft', async () => {
  let current = { state: 'QUEUE', publishDate: new Date(200_000) };
  let poked = false;

  const result = await waitUntilPostScheduled({
    loadPost: async () => current,
    isPoked: () => poked,
    consumePoke: () => { poked = false; },
    waitForPoke: async () => {
      current = { state: 'DRAFT', publishDate: new Date(200_000) };
      poked = true;
      return true;
    },
    now: () => 100_000,
  });

  assert.equal(result, null);
});

test('consumes a poke received before the workflow begins waiting', async () => {
  const versions = [
    { state: 'QUEUE', publishDate: new Date(300_000) },
    { state: 'QUEUE', publishDate: new Date(99_000) },
  ];
  let loads = 0;
  let poked = true;

  const result = await waitUntilPostScheduled({
    loadPost: async () => versions[loads++],
    isPoked: () => poked,
    consumePoke: () => { poked = false; },
    waitForPoke: async () => assert.fail('updated post should already be due'),
    now: () => 100_000,
  });

  assert.equal(result, versions[1]);
  assert.equal(loads, 2);
});

test('stops when the post has been deleted', async () => {
  const result = await waitUntilPostScheduled({
    loadPost: async () => null,
    isPoked: () => false,
    consumePoke: () => undefined,
    waitForPoke: async () => false,
    now: () => 100_000,
  });

  assert.equal(result, null);
});
