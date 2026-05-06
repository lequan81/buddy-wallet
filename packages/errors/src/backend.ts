import type { GenErrorCode } from './gen.errors';
import type { BeErrorCode } from './be.errors';

export * from './gen.errors';
export * from './be.errors';
export * from './base';

export type BackendErrorCode = GenErrorCode | BeErrorCode;
