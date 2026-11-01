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
  startOrReuseWorkflow: () => Promise<WorkflowHandle>;
  signalWorkflow: (workflow: WorkflowHandle) => Promise<void>;
};

/**
 * Reconcile the workflow with the persisted post state without terminating an
 * execution that may be inside an irreversible provider request.
 *
 * The start callback must use Temporal's USE_EXISTING conflict policy. The
 * signal callback must send the workflow's "poke" signal, which causes a
 * scheduled workflow to re-read its state and publish date.
 */
export async function dispatchPostWorkflow<WorkflowHandle>({
  state,
  draftState = 'DRAFT',
  workflowId,
  findRunningWorkflows,
  startOrReuseWorkflow,
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

  const workflow = await startOrReuseWorkflow();
  await signalWorkflow(workflow);

  return { status: 'started_or_reused', workflowId };
}
