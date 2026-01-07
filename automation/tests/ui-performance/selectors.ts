/**
 * UI Performance Test Selectors (SSOT)
 *
 * Centralized selectors for UI performance tests.
 * Separated for consistency with k6 structure (constants.ts, environments.ts, etc.)
 *
 * NOTE: Text/class selectors are fragile - frontend should add data-testid attributes.
 */

export const SELECTORS = {
  // Generic
  BODY: 'body',

  // Menu buttons (using data-testid - good)
  MENU_TRANSACTIONS: '[data-testid="button-menu-transactions"]',
  MENU_ACCOUNTS: '[data-testid="button-menu-accounts"]',
  MENU_FILES: '[data-testid="button-menu-files"]',

  // Transaction tabs (text-based - fragile, needs frontend data-testid)
  PERSONAL_TAB_HISTORY: '[data-testid="tab-1"]',
  TAB_HISTORY: '[data-testid="tab-5"]',
  TAB_READY_TO_SIGN: '[data-testid="tab-2"]',
  TAB_READY_FOR_REVIEW: '[data-testid="tab-1"]',
  TAB_IN_PROGRESS: '[data-testid="tab-3"]',
  TAB_READY_FOR_EXECUTION: '[data-testid="tab-4"]',
  TAB_DRAFTS: '[data-testid="tab-0"]',

  FILE_ROW: '[data-testid^="p-file-id-"]',
  ACCOUNT_ROW: '[data-testid^="p-account-id-"]',
  CONTACT_ROW: '.container-multiple-select',
  BUTTON_DRAFT_CONTINUE: '[data-testid^="button-draft-continue-"]',

  GROUP_ROW_ICON: '.bi-stack',
  BUTTON_DETAILS: 'button:has-text("Details")',
  BUTTON_SIGN_GROUP: '[data-testid="button-sign-group"]',
  BUTTON_CONFIRM: 'button:has-text("Confirm")',
  TOAST_SIGNED_SUCCESS: '.v-toast__item--success .v-toast__text',

  // Loading indicators
  SPINNER_LOADING: '.spinner-border',

  // Pager elements (class-based - fragile, needs frontend data-testid)
  PAGER_SELECT: '.pager-per-page',
  PAGER_ITEMS: '.pager-shown-items',
};
