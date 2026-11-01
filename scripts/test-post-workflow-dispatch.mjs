import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchPostWorkflow } from '../libraries/nestjs-libraries/src/database/prisma/posts/post-workflow.dispatch.ts';

test('starts a queued workflow and signals it to refresh persisted schedule data', async () => {
  const calls = [];
  const result = await dispatchPostWorkflow({
    state: 'QUEUE',
    workflowId: 'post-1',
    findRunningWorkflows: async () => {
      calls.push('list');
      return [];
    },
    startOrReuseWorkflow: async () => {
      calls.push('start-or-reuse');
      return 'workflow-handle';
    },
    signalWorkflow: async (handle) => calls.push(['signal', handle]),
  });

  assert.deepEqual(result, {
    status: 'started_or_reused',
    workflowId: 'post-1',
  });
  assert.deepEqual(calls, [
    'start-or-reuse',
    ['signal', 'workflow-handle'],
  ]);
});

test('does not start a second workflow when a queued workflow already exists', async () => {
  let starts = 0;
  const calls = [];
  const result = await dispatchPostWorkflow({
    state: 'QUEUE',
    workflowId: 'post-2',
    findRunningWorkflows: async () => {
      throw new Error('not used for queued posts');
    },
    startOrReuseWorkflow: async () => {
      starts += 1;
      return 'existing-or-new-handle';
    },
    signalWorkflow: async (handle) => calls.push(handle),
  });

  assert.equal(result.status, 'started_or_reused');
  assert.equal(starts, 1);
  assert.deepEqual(calls, ['existing-or-new-handle']);
});

test('signals every active workflow for a draft without starting another one', async () => {
  const signals = [];
  let starts = 0;
  const result = await dispatchPostWorkflow({
    state: 'DRAFT',
    workflowId: 'post-3',
    findRunningWorkflows: async () => ['workflow-a', 'workflow-b'],
    startOrReuseWorkflow: async () => {
      starts += 1;
      return 'unexpected';
    },
    signalWorkflow: async (handle) => signals.push(handle),
  });

  assert.deepEqual(result, {
    status: 'stop_requested',
    workflowId: 'post-3',
    activeWorkflows: 2,
  });
  assert.deepEqual(signals, ['workflow-a', 'workflow-b']);
  assert.equal(starts, 0);
});

test('does not start a workflow for a draft with no active execution', async () => {
  let starts = 0;
  const result = await dispatchPostWorkflow({
    state: 'DRAFT',
    workflowId: 'post-4',
    findRunningWorkflows: async () => [],
    startOrReuseWorkflow: async () => {
      starts += 1;
      return 'unexpected';
    },
    signalWorkflow: async () => assert.fail('no active workflow to signal'),
  });

  assert.deepEqual(result, {
    status: 'draft',
    workflowId: 'post-4',
    activeWorkflows: 0,
  });
  assert.equal(starts, 0);
});

test('propagates workflow enumeration failures instead of claiming a draft transition', async () => {
  await assert.rejects(
    dispatchPostWorkflow({
      state: 'DRAFT',
      workflowId: 'post-5',
      findRunningWorkflows: async () => {
        throw new Error('Temporal list unavailable');
      },
      startOrReuseWorkflow: async () => 'unexpected',
      signalWorkflow: async () => undefined,
    }),
    /Temporal list unavailable/
  );
});

test('propagates start and signal failures to the caller', async () => {
  await assert.rejects(
    dispatchPostWorkflow({
      state: 'QUEUE',
      workflowId: 'post-6',
      findRunningWorkflows: async () => [],
      startOrReuseWorkflow: async () => {
        throw new Error('Temporal start unavailable');
      },
      signalWorkflow: async () => undefined,
    }),
    /Temporal start unavailable/
  );

  await assert.rejects(
    dispatchPostWorkflow({
      state: 'QUEUE',
      workflowId: 'post-7',
      findRunningWorkflows: async () => [],
      startOrReuseWorkflow: async () => 'workflow-handle',
      signalWorkflow: async () => {
        throw new Error('Temporal signal unavailable');
      },
    }),
    /Temporal signal unavailable/
  );
});
