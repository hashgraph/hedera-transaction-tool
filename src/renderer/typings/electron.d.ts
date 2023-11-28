import { Theme } from '../../main/modules/theme';
import { Organization, SchemaProperties } from '../../main/modules/store';
import { Mnemonic } from '@hashgraph/sdk';

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
    generate: () => Promise<Mnemonic>;
    downloadFileUnencrypted: (words: string[]) => void;
    encryptRecoveryPhrase: (recoveryPhrase: string[]) => Promise<boolean>;
    decryptRecoveryPhrase: () => Promise<string[]>;
  };
  keyPairs: {
    generate: (
      passphrase: string,
      index: number,
    ) => Promise<{
      privateKey: string;
      publicKey: string;
    }>;
    getStored: () => Promise<
      {
        privateKey: string;
        publicKey: string;
      }[]
    >;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
