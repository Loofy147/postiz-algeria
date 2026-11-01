import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchAutopostWorkflow } from '../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.workflow.dispatch.ts';

test('active dispatch uses the start callback', async () => {
  const calls = [];
  const result = await dispatchAutopostWorkflow({
    active: true,
    start: async () => calls.push('start'),
    stop: async () => { calls.push('stop'); return 'stop_requested'; },
    onFailure: () => calls.push('failure'),
  });
  assert.deepEqual(result, { status: 'started_or_reused' });
  assert.deepEqual(calls, ['start']);
});

test('inactive dispatch uses the stop callback', async () => {
  const calls = [];
  const result = await dispatchAutopostWorkflow({
    active: false,
    start: async () => calls.push('start'),
    stop: async () => { calls.push('stop'); return 'stop_requested'; },
    onFailure: () => calls.push('failure'),
  });
  assert.deepEqual(result, { status: 'stop_requested' });
  assert.deepEqual(calls, ['stop']);
});

test('start callback errors return unconfirmed and report the operation', async () => {
  const failures = [];
  const result = await dispatchAutopostWorkflow({
    active: true,
    start: async () => { throw new Error('start unavailable'); },
    stop: async () => 'not_running',
    onFailure: (error, operation) => failures.push([error.message, operation]),
  });
  assert.deepEqual(result, { status: 'unconfirmed' });
  assert.deepEqual(failures, [['start unavailable', 'start']]);
});

test('stop callback errors return unconfirmed and report the operation', async () => {
  const failures = [];
  const result = await dispatchAutopostWorkflow({
    active: false,
    start: async () => undefined,
    stop: async () => { throw new Error('stop unavailable'); },
    onFailure: (error, operation) => failures.push([error.message, operation]),
  });
  assert.deepEqual(result, { status: 'unconfirmed' });
  assert.deepEqual(failures, [['stop unavailable', 'terminate']]);
});


test('reports an already inactive workflow separately from a stop request', async () => {
  const result = await dispatchAutopostWorkflow({
    active: false,
    start: async () => assert.fail('inactive dispatch must not start'),
    stop: async () => 'not_running',
    onFailure: () => assert.fail('missing execution is not an error'),
  });
  assert.deepEqual(result, { status: 'not_running' });
});
