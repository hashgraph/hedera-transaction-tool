export * from './websocket';
export * from './errorCodes';

export const TRANSACTION_MAX_SIZE = 6144; // in bytes
export const TRANSACTION_SIGNATURE_ESTIMATED_MAX_SIZE = 100; // in bytes
export const MEMO_MAX_LENGTH = 100;

/* Encrypted keys */
export const ENCRYPTED_KEY_ALREADY_IMPORTED = 'This key is already imported';

/* File */
export const DISPLAY_FILE_SIZE_LIMIT = 512 * 1024;

/* Claim */
export const DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY = 'default_max_transaction_fee';
export const SELECTED_NETWORK = 'selected_network';
export const USE_KEYCHAIN = 'use_keychain';
export const UPDATE_LOCATION = 'update_location';

/* Transaction tabs */
export const draftsTitle = 'Drafts';
export const readyForReviewTitle = 'Ready for Review';
export const readyToSignTitle = 'Ready to Sign';
export const inProgressTitle = 'In Progress';
export const readyForExecutionTitle = 'Ready for Execution';
export const historyTitle = 'History';

/* Local Storage */
export const LOCAL_STORAGE_IMPORTANT_NOTE_ACCEPTED = 'important-note-accepted';

/* Session Storage */
export const SESSION_STORAGE_AUTH_TOKEN_PREFIX = 'auth-token-';
