/**
 * Exceptions Module entry point
 *
 * Re-exports base HTTP exceptions and domain-specific exceptions.
 */

// Re-export common HTTP exceptions
export * from './Http';

// Domain-specific exceptions
export * from './Debt';
export * from './Auth';
export * from './User';
