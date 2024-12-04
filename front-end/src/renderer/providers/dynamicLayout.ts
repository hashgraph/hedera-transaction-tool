import { provide } from 'vue';

export const DYNAMIC_LAYOUT_KEY = 'dynamicLayoutController';
export type DYNAMIC_LAYOUT_TYPE = {
  loggedInClass: boolean;
  shouldSetupAccountClass: boolean;
  showMenu: boolean;
};

export const DEFAULT_LAYOUT: DYNAMIC_LAYOUT_TYPE = {
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
};
export const LOGGED_IN_LAYOUT: DYNAMIC_LAYOUT_TYPE = {
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
};
export const ACCOUNT_SETUP_LAYOUT: DYNAMIC_LAYOUT_TYPE = {
  loggedInClass: true,
  shouldSetupAccountClass: true,
  showMenu: false,
};

export const provideDynamicLayout = (value: DYNAMIC_LAYOUT_TYPE) => {
  provide(DYNAMIC_LAYOUT_KEY, value);
};

export const setShowMenu = (dynamicLayout: DYNAMIC_LAYOUT_TYPE | undefined, value: boolean) => {
  if (!dynamicLayout) return;

  dynamicLayout.showMenu = value;
};

export const setLoggedInClass = (
  dynamicLayout: DYNAMIC_LAYOUT_TYPE | undefined,
  value: boolean,
) => {
  if (!dynamicLayout) return;

  dynamicLayout.loggedInClass = value;
};

export const setShouldSetupAccountClass = (
  dynamicLayout: DYNAMIC_LAYOUT_TYPE | undefined,
  value: boolean,
) => {
  if (!dynamicLayout) return;

  dynamicLayout.shouldSetupAccountClass = value;
};

export const setSettings = (
  dynamicLayout: DYNAMIC_LAYOUT_TYPE | undefined,
  settings: DYNAMIC_LAYOUT_TYPE,
) => {
  if (!dynamicLayout) return;

  dynamicLayout.loggedInClass = settings.loggedInClass;
  dynamicLayout.shouldSetupAccountClass = settings.shouldSetupAccountClass;
  dynamicLayout.showMenu = settings.showMenu;
};
