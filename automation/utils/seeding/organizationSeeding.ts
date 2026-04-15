import { Mnemonic } from '@hiero-ledger/sdk';
import { Page } from '@playwright/test';
import type { LoginPage } from '../../pages/LoginPage.js';
import type { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { createSeededLocalUserSession, type SeedLocalUserOptions, type SeededLocalUser } from './localUserSeeding.js';
import { setupEnvironmentForTransactions } from '../runtime/environment.js';
import { argonHash, encrypt } from '../crypto/crypto.js';
import { getUserIdByEmail, insertKeyPair, insertUserKey } from '../db/databaseQueries.js';

export interface SeededOrganizationUser extends UserDetails {
  userId: number;
  publicKey: string;
  mnemonicHash: string;
  recoveryPhraseWords: string[];
}

export interface SeedOrganizationUserKeyOptions {
  email: string;
  localPassword: string;
  recoveryPhraseWords?: string[];
  localUserId?: string;
  localOrganizationId?: string;
}

export interface CreateSeededOrganizationSessionOptions {
  userCount?: number;
  organizationUsers?: UserDetails[];
  organizationUserRecoveryPhraseWords?: string[][];
  organizationNickname?: string;
  localUser?: SeedLocalUserOptions;
  signInUserIndex?: number | null;
  leaveSignedIn?: boolean;
  setupPersonalTransactions?: boolean;
  setupOrganizationTransactions?: boolean;
  seedOrganizationKeys?: boolean;
}

export interface SeededOrganizationSession {
  localUser: SeededLocalUser;
  payerPrivateKey: string | null;
  organizationUsers: SeededOrganizationUser[];
}

export async function seedOrganizationUserKey({
  email,
  localPassword,
  recoveryPhraseWords,
  localUserId,
  localOrganizationId,
}: SeedOrganizationUserKeyOptions): Promise<SeededOrganizationUser> {
  const resolvedRecoveryPhraseWords = recoveryPhraseWords ?? (await generateRecoveryPhraseWords());
  const mnemonic = await Mnemonic.fromWords(resolvedRecoveryPhraseWords);
  const standardPrivateKey = await mnemonic.toStandardEd25519PrivateKey('', 0);
  const privateKey = standardPrivateKey.toStringRaw();
  const publicKey = standardPrivateKey.publicKey.toStringRaw();
  const mnemonicHash = await argonHash(resolvedRecoveryPhraseWords.toString(), true);
  const encryptedPrivateKey = encrypt(privateKey, localPassword);
  const userId = await getUserIdByEmail(email);

  if (userId === null) {
    throw new Error(`Organization user ${email} was not found in PostgreSQL`);
  }

  const insertedUserKeyId = await insertUserKey(userId, mnemonicHash, 0, publicKey);

  if (insertedUserKeyId === null) {
    throw new Error(`Failed to seed organization user key for ${email}`);
  }

  await insertKeyPair(
    publicKey,
    encryptedPrivateKey,
    mnemonicHash,
    userId.toString(),
    localUserId,
    localOrganizationId,
  );

  return {
    userId,
    email,
    password: localPassword,
    privateKey,
    publicKey,
    mnemonicHash,
    recoveryPhraseWords: resolvedRecoveryPhraseWords,
  };
}

export async function createSeededOrganizationSession(
  page: Page,
  loginPage: LoginPage,
  organizationPage: OrganizationPage,
  options: CreateSeededOrganizationSessionOptions = {},
): Promise<SeededOrganizationSession> {
  const localUser = await createSeededLocalUserSession(page, loginPage, options.localUser);
  await deleteExistingLocalOrganizationConnection(page, process.env.ORGANIZATION_URL ?? '');
  const shouldSetupPersonalTransactions = options.setupPersonalTransactions ?? true;
  const shouldSetupOrganizationTransactions = options.setupOrganizationTransactions ?? true;
  const shouldSeedOrganizationKeys = options.seedOrganizationKeys ?? true;

  const payerPrivateKey = shouldSetupPersonalTransactions
    ? await setupEnvironmentForTransactions(page)
    : null;

  organizationPage.users = [];
  organizationPage.organizationRecoveryWords = [];
  organizationPage.transactions = [];

  if (options.organizationUsers) {
    organizationPage.users.push(
      ...options.organizationUsers.map(user => ({
        ...user,
      })),
    );
  } else {
    await organizationPage.createUsers(options.userCount ?? 1);
  }

  await organizationPage.setupOrganization(options.organizationNickname);
  await organizationPage.waitForElementToBeVisible(
    organizationPage.emailForOrganizationInputSelector,
  );
  const localOrganizationId = await getLocalOrganizationId(
    page,
    process.env.ORGANIZATION_URL ?? '',
  );

  const seededOrganizationUsers: SeededOrganizationUser[] = [];

  if (shouldSeedOrganizationKeys) {
    for (let index = 0; index < organizationPage.users.length; index++) {
      const user = organizationPage.getUser(index);
      const seededUser = await seedOrganizationUserKey({
        email: user.email,
        localPassword: localUser.password,
        recoveryPhraseWords: options.organizationUserRecoveryPhraseWords?.[index],
        localUserId: localUser.userId,
        localOrganizationId,
      });

      organizationPage.users[index].privateKey = seededUser.privateKey;
      organizationPage.organizationRecoveryWords[index] = indexRecoveryPhraseWords(
        seededUser.recoveryPhraseWords,
      );
      seededOrganizationUsers.push(seededUser);
    }
  }

  const signInUserIndex = resolveSignInUserIndex(
    options.signInUserIndex,
    organizationPage.users.length,
  );

  if (signInUserIndex !== null) {
    const activeUser = organizationPage.getUser(signInUserIndex);
    await organizationPage.signInOrganization(
      activeUser.email,
      activeUser.password,
      localUser.password,
    );

    if (signInUserIndex === 0 && shouldSetupOrganizationTransactions && payerPrivateKey) {
      await setupEnvironmentForTransactions(page, payerPrivateKey);
      organizationPage.users[0].privateKey = payerPrivateKey;
    }

    if (!(options.leaveSignedIn ?? true)) {
      await organizationPage.logoutFromOrganization();
    }
  }

  return {
    localUser,
    payerPrivateKey,
    organizationUsers: seededOrganizationUsers,
  };
}

export function indexRecoveryPhraseWords(words: string[]): string[] {
  const indexedWords: string[] = [];

  words.forEach((word, index) => {
    indexedWords[index + 1] = word;
  });

  return indexedWords;
}

export function resolveSignInUserIndex(
  requestedIndex: number | null | undefined,
  usersLength: number,
): number | null {
  if (requestedIndex === null) {
    return null;
  }

  if (requestedIndex === undefined) {
    return usersLength === 0 ? null : 0;
  }

  if (usersLength === 0) {
    throw new Error(
      `Invalid signInUserIndex ${requestedIndex}. No organization users are available to sign in.`,
    );
  }

  if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= usersLength) {
    throw new Error(
      `Invalid signInUserIndex ${requestedIndex}. Expected an integer between 0 and ${
        usersLength - 1
      }.`,
    );
  }

  return requestedIndex;
}

async function generateRecoveryPhraseWords(): Promise<string[]> {
  return (await Mnemonic.generate()).toString().split(' ');
}

async function deleteExistingLocalOrganizationConnection(page: Page, serverUrl: string): Promise<void> {
  if (!serverUrl) {
    return;
  }

  await page.evaluate(async targetServerUrl => {
    type LocalOrganization = {
      id: string;
      serverUrl: string;
    };

    type ElectronApiWindow = Window & {
      electronAPI: {
        local: {
          organizations: {
            getOrganizations: () => Promise<LocalOrganization[]>;
            deleteOrganization: (id: string) => Promise<boolean>;
          };
        };
      };
    };

    const electronWindow = window as unknown as ElectronApiWindow;
    const organizations = await electronWindow.electronAPI.local.organizations.getOrganizations();

    for (const organization of organizations) {
      if (organization.serverUrl !== targetServerUrl) {
        continue;
      }

      await electronWindow.electronAPI.local.organizations.deleteOrganization(organization.id);

      try {
        const origin = new URL(targetServerUrl).origin;
        sessionStorage.removeItem(`auth-token-${origin}`);
      } catch {
        // Ignore malformed URLs here. The add-organization flow will fail with the
        // real validation error if the configured organization URL is invalid.
      }
    }
  }, serverUrl);
}

async function getLocalOrganizationId(page: Page, serverUrl: string): Promise<string> {
  if (!serverUrl) {
    throw new Error('ORGANIZATION_URL is not configured');
  }

  return await page.evaluate(async targetServerUrl => {
    type LocalOrganization = {
      id: string;
      serverUrl: string;
    };

    type ElectronApiWindow = Window & {
      electronAPI: {
        local: {
          organizations: {
            getOrganizations: () => Promise<LocalOrganization[]>;
          };
        };
      };
    };

    const electronWindow = window as unknown as ElectronApiWindow;
    const organizations = await electronWindow.electronAPI.local.organizations.getOrganizations();
    const match = organizations.find(org => org.serverUrl === targetServerUrl);

    if (!match) {
      throw new Error(`Local organization ${targetServerUrl} was not found in SQLite`);
    }

    return match.id;
  }, serverUrl);
}
