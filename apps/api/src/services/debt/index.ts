/**
 * Debt Services - Index
 * 
 * Split from original DebtService following SRP:
 * - DebtCrudService: Core CRUD operations
 * - DebtStatusService: Status management and suggestions
 * - DebtBatchService: Batch operations
 * - DebtServiceBase: Shared helpers (OOP inheritance)
 * 
 * Re-export for backward compatibility
 */
export { DebtCrudService } from './debt-crud.service';
export { DebtStatusService } from './debt-status.service';
export { DebtBatchService } from './debt-batch.service';
export { DebtServiceBase } from './debt-base.service';
export { toDebtDetails, calculateExpiryDate, MS_PER_DAY } from './debt.utils';
export type { ExpiryOption } from './debt.utils';

// Legacy DebtService removed - use split services via DI
