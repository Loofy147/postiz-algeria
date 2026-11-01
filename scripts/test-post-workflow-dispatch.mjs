import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchPostWorkflow } from '../libraries/nestjs-libraries/src/database/prisma/posts/post-workflow.dispatch.ts';

test('queued dispatch uses one atomic signal-with-start operation', async () => {
  const calls = [];
  const result = await dispatchPostWorkflow({
    state: 'QUEUE',
    workflowId: 'post-1',
    findRunningWorkflows: async () => {
      calls.push('list');
      return [];
    },
    signalWithStartWorkflow: async () => {
      calls.push('signal-with-start');
    },
    signalWorkflow: async (handle) => calls.push(['signal-existing', handle]),
  });

  assert.deepEqual(result, {
    status: 'started_or_reused',
    workflowId: 'post-1',
  });
  assert.deepEqual(calls, ['signal-with-start']);
});

test('queued dispatch does not enumerate workflows before atomic signal-with-start', async () => {
  let operations = 0;
  const result = await dispatchPostWorkflow({
    state: 'QUEUE',
    workflowId: 'post-2',
    findRunningWorkflows: async () => {
      throw new Error('queued dispatch must not perform a non-atomic preflight');
    },
    signalWithStartWorkflow: async () => {
      operations += 1;
    },
    signalWorkflow: async () => assert.fail('no separate signal is expected'),
  });

  assert.equal(result.status, 'started_or_reused');
  assert.equal(operations, 1);
});

test('signals every active workflow for a draft without starting another one', async () => {
  const signals = [];
  let starts = 0;
  const result = await dispatchPostWorkflow({
    state: 'DRAFT',
    workflowId: 'post-3',
    findRunningWorkflows: async () => ['workflow-a', 'workflow-b'],
    signalWithStartWorkflow: async () => {
      starts += 1;
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
    signalWithStartWorkflow: async () => {
      starts += 1;
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

test('propagates workflow enumeration failures for draft transitions', async () => {
  await assert.rejects(
    dispatchPostWorkflow({
      state: 'DRAFT',
      workflowId: 'post-5',
      findRunningWorkflows: async () => {
        throw new Error('Temporal list unavailable');
      },
      signalWithStartWorkflow: async () => undefined,
      signalWorkflow: async () => undefined,
    }),
    /Temporal list unavailable/
  );
});

test('propagates signal-with-start failure to the caller', async () => {
  await assert.rejects(
    dispatchPostWorkflow({
      state: 'QUEUE',
      workflowId: 'post-6',
      findRunningWorkflows: async () => [],
      signalWithStartWorkflow: async () => {
        throw new Error('Temporal signal-with-start unavailable');
      },
      signalWorkflow: async () => undefined,
    }),
    /Temporal signal-with-start unavailable/
  );
});

test('propagates draft signal failure to the caller', async () => {
  await assert.rejects(
    dispatchPostWorkflow({
      state: 'DRAFT',
      workflowId: 'post-7',
      findRunningWorkflows: async () => ['workflow-a'],
      signalWithStartWorkflow: async () => assert.fail('draft cannot start'),
      signalWorkflow: async () => {
        throw new Error('Temporal draft signal unavailable');
      },
    }),
    /Temporal draft signal unavailable/
  );
});
