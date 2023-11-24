import { Theme } from '../../main/modules/theme';
import { SchemaProperties } from '../../main/modules/store';

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
  config: {
    mirrorNodeLinks: {
      setLink: (key: keyof SchemaProperties['mirrorNodeLinks'], link: string) => Promise<string>;
      getLinks: () => Promise<SchemaProperties['mirrorNodeLinks']>;
    };
  };
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
