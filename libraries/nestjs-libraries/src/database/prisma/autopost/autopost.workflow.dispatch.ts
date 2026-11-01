export type AutopostWorkflowDispatchStatus =
  | 'started_or_reused'
  | 'stop_requested'
  | 'unconfirmed';

type AutopostWorkflowDispatchOptions = {
  active: boolean;
  start: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  onFailure: (error: unknown, operation: 'start' | 'terminate') => void;
};

/** Execute an autopost workflow transition and never hide failed orchestration. */
export async function dispatchAutopostWorkflow({
  active,
  start,
  stop,
  onFailure,
}: AutopostWorkflowDispatchOptions): Promise<{ status: AutopostWorkflowDispatchStatus }> {
  const operation = active ? 'start' : 'terminate';

  try {
    if (active) {
      await start();
      return { status: 'started_or_reused' };
    }

    await stop();
    return { status: 'stop_requested' };
  } catch (error) {
    onFailure(error, operation);
    return { status: 'unconfirmed' };
  }
}
