import type { GenErrorCode } from './gen.errors';
import type { FeErrorCode } from './fe.errors';
import type { BeErrorCode } from './be.errors';

export * from './base';
export type { ErrorDefinition, ErrorEntry } from './factory';

export type ErrorCode = GenErrorCode | FeErrorCode | BeErrorCode;
