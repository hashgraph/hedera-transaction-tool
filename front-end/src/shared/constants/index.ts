export * from './websocket';
export * from './errorCodes';
export * from './network';
export * from './updateErrors';

export const TRANSACTION_MAX_SIZE = 6144; // in bytes
export const TRANSACTION_SIGNATURE_ESTIMATED_MAX_SIZE = 100; // in bytes
export const MEMO_MAX_LENGTH = 100;

/* Keychain */
export const STATIC_USER = 'keychain@mode';

/* Encrypted keys */
export const ENCRYPTED_KEY_ALREADY_IMPORTED = 'This key is already imported';

/* File */
export const DISPLAY_FILE_SIZE_LIMIT = 512 * 1024;

/* Claim */
export const DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY = 'default_max_transaction_fee';
export const SELECTED_NETWORK = 'selected_network';
export const LAST_SELECTED_ORGANIZATION = 'last_selected_organization';
export const DEFAULT_ORGANIZATION_OPTION = 'default_organization_option';
export const DATE_TIME_PREFERENCE = 'date_time_preference';
export const USE_KEYCHAIN = 'use_keychain';
export const UPDATE_LOCATION = 'update_location';
export const ACCOUNT_SETUP_STARTED = 'account_setup_started';
export const RECOVERY_PHRASE_HASH_UPDATED = 'recovery_phrase_hash_updated';
export const WINDOW_STATE = 'window_state';
export const SKIPPED_PERSONAL_SETUP = 'skipped_personal_setup';
export const SKIPPED_ORGANIZATION_SETUP = 'skipped_organization_setup';
export const GO_NEXT_AFTER_SIGN = 'go_next_after_sign';

/* Transaction tabs */
export const draftsTitle = 'Drafts';
export const readyForReviewTitle = 'Ready for Review';
export const readyToSignTitle = 'Ready to Sign';
export const inProgressTitle = 'In Progress';
export const readyForExecutionTitle = 'Ready for Execution';
export const historyTitle = 'History';

/* Local Storage */
export const LOCAL_STORAGE_IMPORTANT_NOTE_ACCEPTED = 'important-note-accepted';
export const HTX_USER = 'htx_user';

/* Session Storage */
export const SESSION_STORAGE_AUTH_TOKEN_PREFIX = 'auth-token-';
export const SESSION_STORAGE_DISMISSED_UPDATE_PROMPT = 'dismissed-update-prompt';
