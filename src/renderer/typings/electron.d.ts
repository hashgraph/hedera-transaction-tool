import { Theme } from '../../interfaces/theme';

/**
 * Should match main/preload.ts for typescript support in renderer
 */
export default interface ElectronApi {
  sendMessage: (message: string) => void;
  getNodeEnv: () => string;
  theme: {
    isDark: () => Promise<boolean>;
    toggle: (theme: Theme) => Promise<boolean>;
    onThemeUpdate: (callback: (theme: boolean) => void) => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
