/** Base workflow states shared across all job types */
export type BaseWorkflowState =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled';

/** Generic workflow state with type-specific extensions */
export type WorkflowState<TExtension extends string = never> =
  | BaseWorkflowState
  | TExtension;

/** Import-specific states */
export type ImportState = WorkflowState<'preview'>;

/** Job-specific states */
export type JobState = WorkflowState<'preview' | 'completed'>;
