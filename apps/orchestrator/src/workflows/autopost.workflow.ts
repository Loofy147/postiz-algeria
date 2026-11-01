import {
  continueAsNew,
  condition,
  defineSignal,
  patched,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import { AutopostActivity } from '@gitroom/orchestrator/activities/autopost.activity';

const { autoPost } = proxyActivities<AutopostActivity>({
  startToCloseTimeout: '10 minute',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

const activate = defineSignal('activate');
const stop = defineSignal('stop');

export async function autoPostWorkflow({
  id,
  immediately,
}: {
  id: string;
  immediately: boolean;
}) {
  let loops = 0;
  let shouldRun = immediately;
  let stopRequested = false;

  // Stop is graceful: let an already-running activity return before exiting.
  setHandler(stop, () => {
    stopRequested = true;
    shouldRun = false;
  });
  setHandler(activate, () => {
    stopRequested = false;
    shouldRun = true;
  });

  while (true) {
    if (stopRequested) {
      return;
    }

    if (shouldRun) {
      shouldRun = false;
      try {
        await autoPost(id);
      } catch (err) {}
      if (stopRequested) {
        return;
      }
    }

    const awakened = await condition(
      () => stopRequested || shouldRun,
      3600000
    );

    if (stopRequested) {
      return;
    }

    if (!awakened) {
      shouldRun = true;
    }

    // Keep the history small and preserve an activation that woke this run.
    if (
      patched('autopost-continue-as-new') &&
      (++loops >= 24 || workflowInfo().historyLength > 1000)
    ) {
      return await continueAsNew<typeof autoPostWorkflow>({
        id,
        immediately: shouldRun,
      });
    }
  }
}
