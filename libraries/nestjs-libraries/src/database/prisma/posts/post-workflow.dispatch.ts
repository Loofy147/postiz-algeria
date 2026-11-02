export type PostWorkflowDispatchResult =
  | {
      status: 'started_or_reused';
      workflowId: string;
    }
  | {
      status: 'stop_requested';
      workflowId: string;
      activeWorkflows: number;
    }
  | {
      status: 'draft';
      workflowId: string;
      activeWorkflows: 0;
    };

type DispatchPostWorkflowOptions<WorkflowHandle> = {
  state: string;
  draftState?: string;
  workflowId: string;
  findRunningWorkflows: () => Promise<WorkflowHandle[]>;
  signalWithStartWorkflow: () => Promise<unknown>;
  signalWorkflow: (workflow: WorkflowHandle) => Promise<void>;
};

/**
 * Reconcile a post workflow without terminating an execution that may be
 * inside an irreversible provider request.
 *
 * Queued posts use Temporal Signal-With-Start so start/reuse and the poke signal
 * are one atomic server operation. Draft transitions only signal executions
 * already known to be running and never create a workflow.
 */
export async function dispatchPostWorkflow<WorkflowHandle>({
  state,
  draftState = 'DRAFT',
  workflowId,
  findRunningWorkflows,
  signalWithStartWorkflow,
  signalWorkflow,
}: DispatchPostWorkflowOptions<WorkflowHandle>): Promise<PostWorkflowDispatchResult> {
  if (state === draftState) {
    const runningWorkflows = await findRunningWorkflows();

    for (const workflow of runningWorkflows) {
      await signalWorkflow(workflow);
    }

    return runningWorkflows.length
      ? {
          status: 'stop_requested',
          workflowId,
          activeWorkflows: runningWorkflows.length,
        }
      : { status: 'draft', workflowId, activeWorkflows: 0 };
  }

  await signalWithStartWorkflow();
  return { status: 'started_or_reused', workflowId };
}
