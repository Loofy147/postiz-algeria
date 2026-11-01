export type AutopostSignal = 'activate' | 'stop';

export type AutopostLifecycleState = {
  stopRequested: boolean;
  shouldRun: boolean;
  activityRunning: boolean;
};

/**
 * Apply a lifecycle signal without queuing a duplicate cycle while the
 * current multi-integration activity is already executing.
 */
export function applyAutopostSignal(
  state: AutopostLifecycleState,
  signal: AutopostSignal
): AutopostLifecycleState {
  if (signal === 'stop') {
    return {
      ...state,
      stopRequested: true,
      shouldRun: false,
    };
  }

  return {
    ...state,
    stopRequested: false,
    // An in-flight activity already satisfies activation. Do not schedule a
    // second cycle simply because the user clicked activate again mid-run.
    shouldRun: state.activityRunning ? state.shouldRun : true,
  };
}
