import type { ImportState } from './workflow';

/** @deprecated Use ImportState from './workflow' instead */
export type ImportWorkflowState = ImportState;

export type ImportWorkflowLegacyState = ImportState | 'completed';

export interface ImportWorkflowTransition {
  from: ImportWorkflowState;
  to: ImportWorkflowState;
  allowed: boolean;
  reason?: string;
}
