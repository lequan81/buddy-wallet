export type ImportWorkflowState =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled';

export type ImportWorkflowLegacyState = ImportWorkflowState | 'preview' | 'completed';

export interface ImportWorkflowTransition {
  from: ImportWorkflowState;
  to: ImportWorkflowState;
  allowed: boolean;
  reason?: string;
}
