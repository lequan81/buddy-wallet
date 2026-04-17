import type { GenErrorCode } from './gen.errors';
import type { FeErrorCode } from './fe.errors';

export * from './gen.errors';
export * from './fe.errors';
export * from './base';

export type FrontendErrorCode = GenErrorCode | FeErrorCode;
