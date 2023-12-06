import { Theme } from '../../main/modules/ipcHandlers/theme';
import { Organization, SchemaProperties } from '../../main/modules/store';
import { IKeyPair } from '../../main/shared/interfaces/IKeyPair';

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
    clear: () => Promise<void>;
    mirrorNodeLinks: {
      setLink: (key: keyof SchemaProperties['mirrorNodeLinks'], link: string) => Promise<string>;
      getLinks: () => Promise<SchemaProperties['mirrorNodeLinks']>;
    };
    organizations: {
      getAll: () => Promise<Organization[]>;
      add: (organization: Organization) => Promise<void>;
      removeByServerURL: (serverUrl: string) => Promise<void>;
    };
  };
  recoveryPhrase: {
    downloadFileUnencrypted: (words: string[]) => void;
  };
  privateKey: {
    getStored: () => Promise<IKeyPair[]>;
    store: (password: string, keyPair: IKeyPair) => Promise<void>;
    clear: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
