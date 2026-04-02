import { Mnemonic } from '@hashgraph/sdk';
import { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { generateRandomEmail, generateRandomPassword } from './automationSupport.js';
import { argonHash } from './crypto.js';

const SELECTED_NETWORK_CLAIM_KEY = 'selected_network';

type SeedLocalUserPayload = {
  claimKey: string;
  email: string;
  password: string;
  publicKey: string;
  privateKey: string;
  mnemonicHash: string;
  selectedNetwork: string | null;
};

type SeedLocalUserResult = {
  id: string;
  email: string;
};

type ElectronApiWindow = Window & {
  electronAPI: {
    local: {
      claim: {
        add: (userId: string, claimKey: string, claimValue: string) => Promise<void>;
      };
      keyPairs: {
        store: (
          keyPair: Record<string, unknown>,
          password: string | null,
          encrypted: boolean,
        ) => Promise<void>;
      };
      localUser: {
        register: (email: string, password: string) => Promise<SeedLocalUserResult>;
      };
      safeStorage: {
        initializeUseKeychain: (useKeychain: boolean) => Promise<void>;
      };
    };
  };
};

export interface SeededLocalUser {
  userId: string;
  email: string;
  password: string;
  mnemonicHash: string;
  privateKey: string;
  publicKey: string;
  recoveryPhraseWords: string[];
  recoveryPhraseWordMap: Record<string, string>;
}

export interface SeedLocalUserOptions {
  email?: string;
  password?: string;
  recoveryPhraseWords?: string[];
  selectedNetwork?: string | null;
}

export async function seedLocalUserBaseline(
  page: Page,
  options: SeedLocalUserOptions = {},
): Promise<SeededLocalUser> {
  const email = options.email ?? generateRandomEmail();
  const password = options.password ?? generateRandomPassword();
  const recoveryPhraseWords = options.recoveryPhraseWords ?? (await generateRecoveryPhraseWords());
  const mnemonic = await Mnemonic.fromWords(recoveryPhraseWords);
  const standardPrivateKey = await mnemonic.toStandardEd25519PrivateKey('', 0);
  const privateKey = standardPrivateKey.toStringRaw();
  const publicKey = standardPrivateKey.publicKey.toStringRaw();
  const mnemonicHash = await argonHash(recoveryPhraseWords.toString(), true);
  const selectedNetwork = options.selectedNetwork ?? null;

  const seededUser = await page.evaluate(async (payload: SeedLocalUserPayload) => {
    const electronWindow = window as unknown as ElectronApiWindow;

    try {
      await electronWindow.electronAPI.local.safeStorage.initializeUseKeychain(false);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already initialized')) {
        throw error;
      }
    }

    const user = await electronWindow.electronAPI.local.localUser.register(
      payload.email,
      payload.password,
    );

    await electronWindow.electronAPI.local.keyPairs.store(
      {
        user_id: user.id,
        index: 0,
        public_key: payload.publicKey,
        private_key: payload.privateKey,
        type: 'ED25519',
        organization_id: null,
        organization_user_id: null,
        secret_hash: payload.mnemonicHash,
        nickname: null,
      },
      payload.password,
      false,
    );

    if (payload.selectedNetwork) {
      await electronWindow.electronAPI.local.claim.add(
        user.id,
        payload.claimKey,
        payload.selectedNetwork,
      );
    }

    return user;
  }, {
    claimKey: SELECTED_NETWORK_CLAIM_KEY,
    email,
    password,
    publicKey,
    privateKey,
    mnemonicHash,
    selectedNetwork,
  });

  return {
    userId: seededUser.id,
    email,
    password,
    mnemonicHash,
    privateKey,
    publicKey,
    recoveryPhraseWords,
    recoveryPhraseWordMap: createRecoveryPhraseWordMap(recoveryPhraseWords),
  };
}

export async function createSeededLocalUserSession(
  page: Page,
  loginPage: LoginPage,
  options: SeedLocalUserOptions = {},
): Promise<SeededLocalUser> {
  const seededUser = await seedLocalUserBaseline(page, options);
  await reloadSeededLoginPage(page, loginPage);
  await loginPage.assertSignInMode('seeded local baseline');
  await loginPage.login(seededUser.email, seededUser.password);
  await loginPage.waitForElementToBeVisible(loginPage.settingsButtonSelector);
  return seededUser;
}

export function createRecoveryPhraseWordMap(words: string[]): Record<string, string> {
  return Object.fromEntries(words.map((word, index) => [`${index + 1}`, word]));
}

async function generateRecoveryPhraseWords(): Promise<string[]> {
  return (await Mnemonic.generate()).toString().split(' ');
}

async function reloadSeededLoginPage(page: Page, loginPage: LoginPage): Promise<void> {
  await page.evaluate(async () => {
    type VueAppContainer = HTMLElement & {
      __vue_app__?: {
        config?: {
          globalProperties?: {
            $router?: {
              push: (target: { name: string }) => Promise<void>;
            };
          };
        };
      };
    };

    const appRoot = document.querySelector('#app') as VueAppContainer | null;
    const router = appRoot?.__vue_app__?.config?.globalProperties?.$router;

    if (!router) {
      throw new Error('Unable to access Vue router to remount the login page');
    }

    await router.push({ name: 'styleGuide' });
    await router.push({ name: 'login' });
  });

  await loginPage.assertSignInMode('seeded local baseline route refresh');
}
