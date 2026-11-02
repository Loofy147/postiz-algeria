export type AutopostWorkflowDispatchStatus =
  | 'started_or_reused'
  | 'stop_requested'
  | 'not_running'
  | 'unconfirmed';

type AutopostWorkflowDispatchOptions = {
  active: boolean;
  start: () => Promise<unknown>;
  stop: () => Promise<'stop_requested' | 'not_running'>;
  onFailure: (error: unknown, operation: 'start' | 'terminate') => void;
};

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

    return { status: await stop() };
  } catch (error) {
    onFailure(error, operation);
    return { status: 'unconfirmed' };
  }
}
