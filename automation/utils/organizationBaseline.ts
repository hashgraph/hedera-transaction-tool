import { Mnemonic } from '@hashgraph/sdk';
import { Page } from '@playwright/test';
import type { LoginPage } from '../pages/LoginPage.js';
import type { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { createSeededLocalUserSession, type SeedLocalUserOptions, type SeededLocalUser } from './localBaseline.js';
import { setupEnvironmentForTransactions } from './automationSupport.js';
import { argonHash, encrypt } from './crypto.js';
import { getUserIdByEmail, insertKeyPair, insertUserKey } from './databaseQueries.js';

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
}

export interface CreateSeededOrganizationSessionOptions {
  userCount?: number;
  organizationUsers?: UserDetails[];
  organizationUserRecoveryPhraseWords?: string[][];
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

  await insertKeyPair(publicKey, encryptedPrivateKey, mnemonicHash, userId.toString());

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
  const shouldSetupPersonalTransactions = options.setupPersonalTransactions ?? true;
  const shouldSetupOrganizationTransactions = options.setupOrganizationTransactions ?? true;
  const shouldSeedOrganizationKeys = options.seedOrganizationKeys ?? true;

  const payerPrivateKey = shouldSetupPersonalTransactions
    ? await setupEnvironmentForTransactions(page)
    : null;

  organizationPage.users = [];
  organizationPage.organizationRecoveryWords = [];

  if (options.organizationUsers) {
    organizationPage.users.push(
      ...options.organizationUsers.map(user => ({
        ...user,
      })),
    );
  } else {
    await organizationPage.createUsers(options.userCount ?? 1);
  }

  await organizationPage.setupOrganization();
  await organizationPage.waitForElementToBeVisible(
    organizationPage.emailForOrganizationInputSelector,
  );

  const seededOrganizationUsers: SeededOrganizationUser[] = [];

  if (shouldSeedOrganizationKeys) {
    for (let index = 0; index < organizationPage.users.length; index++) {
      const user = organizationPage.getUser(index);
      const seededUser = await seedOrganizationUserKey({
        email: user.email,
        localPassword: localUser.password,
        recoveryPhraseWords: options.organizationUserRecoveryPhraseWords?.[index],
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

function resolveSignInUserIndex(
  requestedIndex: number | null | undefined,
  usersLength: number,
): number | null {
  if (usersLength === 0) {
    return null;
  }

  return requestedIndex === undefined ? 0 : requestedIndex;
}

async function generateRecoveryPhraseWords(): Promise<string[]> {
  return (await Mnemonic.generate()).toString().split(' ');
}
