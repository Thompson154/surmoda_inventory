// WHY: single source of truth for error codes lives in @surmoda/contracts (Constitution § 4.5).
// Re-export so all internal consumers keep their import paths unchanged.
export { ERROR_CODES, type ErrorCode } from '@surmoda/contracts';
