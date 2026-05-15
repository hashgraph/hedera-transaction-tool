export const ELECTRON_APP_MODES = {
  LAUNCH: 'launch',
  ATTACH: 'attach',
} as const;

export type TransactionToolAppMode =
  typeof ELECTRON_APP_MODES[keyof typeof ELECTRON_APP_MODES];
