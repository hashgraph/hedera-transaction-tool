import type { Ref } from 'vue';
import type { Router } from 'vue-router';
import type { KeyPair, Organization } from '@prisma/client';
import type { IUserKey } from '@main/shared/interfaces';
import type {
  ConnectedOrganization,
  LoggedInOrganization,
  LoggedOutOrganization,
  LoggedInUser,
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  LoggedInUserWithPassword,
  OrganizationTokens,
} from '@renderer/types';

import { nextTick } from 'vue';

import { Prisma } from '@prisma/client';
import { Mnemonic } from '@hashgraph/sdk';

import { SELECTED_NETWORK, SESSION_STORAGE_AUTH_TOKEN_PREFIX } from '@main/shared/constants';

import { getUserState, healthCheck } from '@renderer/services/organization';
import { getAccountIds, getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService';
import { storeKeyPair as storeKey, getKeyPairs } from '@renderer/services/keyPairService';
import {
  shouldSignInOrganization,
  deleteOrganizationCredentials,
  getOrganizationTokens,
} from '@renderer/services/organizationCredentials';
import { deleteOrganization, getOrganizations } from '@renderer/services/organizationsService';
import {
  hashData,
  compareHash,
  compareDataToHashes,
} from '@renderer/services/electronUtilsService';
import { getStoredClaim } from '@renderer/services/claimService';

import { safeAwait } from './safeAwait';

/* Flags */
export function assertUserLoggedIn(user: PersonalUser | null): asserts user is LoggedInUser {
  if (!isUserLoggedIn(user)) throw Error('User is not logged in');
}

export const isUserLoggedIn = (user: PersonalUser | null): user is LoggedInUser => {
  return user !== null && user.isLoggedIn;
};

export const isLoggedInWithPassword = (
  user: PersonalUser | null,
): user is LoggedInUserWithPassword => {
  return isUserLoggedIn(user) && user.password !== null && user.password.trim() !== '';
};

export const isLoggedInWithValidPassword = (
  user: PersonalUser | null,
): user is LoggedInUserWithPassword => {
  const hasPassword = isLoggedInWithPassword(user);
  if (!hasPassword) return false;

  const isExpired = user.passwordExpiresAt && new Date(user.passwordExpiresAt) < new Date();

  return !isExpired;
};

export const isOrganizationActive = (organization: ConnectedOrganization | null): boolean => {
  return organization !== null && organization.isServerActive;
};

export const isLoggedOutOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedOutOrganization => {
  return organization !== null && organization.isServerActive && organization.loginRequired;
};

export function assertIsLoggedInOrganization(
  organization: ConnectedOrganization | null,
): asserts organization is Organization & LoggedInOrganization {
  if (!isLoggedInOrganization(organization)) throw Error('User is not logged in an organization');
}

export const isLoggedInOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedInOrganization => {
  return organization !== null && organization.isServerActive && !organization.loginRequired;
};

export const accountSetupRequired = (
  organization: ConnectedOrganization | null,
  localKeys: KeyPair[],
) => {
  if (getSecretHashesFromKeys(localKeys).length === 0) return true;
  if (!organization || !isLoggedInOrganization(organization)) return false;

  if (organization.isPasswordTemporary) return true;
  if (organization.secretHashes.length === 0) return true;
  if (
    !organization.userKeys
      .filter(key => key.mnemonicHash)
      .some(key => localKeys.some(k => k.public_key === key.publicKey))
  )
    return true;

  return false;
};

export type AccountSetupPart = 'password' | 'keys';

export const accountSetupRequiredParts = (
  organization: ConnectedOrganization | null,
  localKeys: KeyPair[],
): AccountSetupPart[] => {
  const parts = new Set<AccountSetupPart>();

  if (getSecretHashesFromKeys(localKeys).length === 0) parts.add('keys');
  if (!organization || !isLoggedInOrganization(organization)) return [...parts];

  if (organization.isPasswordTemporary) parts.add('password');
  if (organization.secretHashes.length === 0) parts.add('keys');
  if (
    !organization.userKeys
      .filter(key => key.mnemonicHash)
      .some(key => localKeys.some(k => k.public_key === key.publicKey))
  )
    parts.add('keys');

  return [...parts];
};

/* Entity creation */
export const createPersonalUser = (
  id?: string,
  email?: string,
  useKeychain?: boolean,
): PersonalUser =>
  id && email
    ? {
        isLoggedIn: true,
        id,
        email,
        password: null,
        useKeychain: useKeychain || false,
      }
    : { isLoggedIn: false };

export const createRecoveryPhrase = async (words: string[]): Promise<RecoveryPhrase> => {
  try {
    const mnemonic = await Mnemonic.fromWords(words);
    const hash = await hashData(words.toString());

    return {
      mnemonic,
      words,
      hash,
    };
  } catch {
    throw Error('Invalid recovery phrase');
  }
};

export const storeKeyPair = async (
  keyPair: Prisma.KeyPairUncheckedCreateInput,
  mnemonic: string[] | string | null,
  password: string | null,
  encrypted: boolean,
) => {
  if (mnemonic) {
    if (Array.isArray(mnemonic)) {
      keyPair.secret_hash = await hashData([...mnemonic].toString());
    } else {
      keyPair.secret_hash = mnemonic;
    }
  }
  await storeKey(keyPair, password, encrypted);
};

/* Fetching */
export const getLocalKeyPairs = async (
  user: PersonalUser | null,
  selectedOrganization: ConnectedOrganization | null,
) => {
  if (!user?.isLoggedIn) {
    throw Error('Login to fetch keys');
  }

  let keyPairs = await getKeyPairs(
    user.id,
    selectedOrganization !== null ? selectedOrganization.id : null,
  );

  keyPairs = keyPairs.sort((k1, k2) => {
    if (k1.index < 0) {
      if (k2.index < 0) {
        return k1.nickname && k2.nickname
          ? k1.nickname.localeCompare(k2.nickname)
          : k1.nickname
            ? -1
            : 1;
      }
      return 1;
    } else {
      return k1.index - k2.index;
    }
  });

  return keyPairs;
};

export const updateKeyPairs = async (
  keyPairs: Ref<KeyPair[]>,
  user: PersonalUser | null,
  selectedOrganization: ConnectedOrganization | null,
) => {
  if (user?.isLoggedIn) {
    const newKeys = await getLocalKeyPairs(user, selectedOrganization);
    keyPairs.value = newKeys;
  } else {
    keyPairs.value = [];
  }
};

export const getPublicKeysToAccounts = async (keyPairs: KeyPair[], mirrorNodeBaseURL: string) => {
  const publicKeyToAccounts: PublicKeyAccounts[] = [];

  const results = await Promise.allSettled(
    keyPairs.map(kp => getAccountsByPublicKey(mirrorNodeBaseURL, kp.public_key)),
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const keyPair = keyPairs[i];

      const publicKeyPair = publicKeyToAccounts.findIndex(
        pkToAcc => pkToAcc.publicKey === keyPair.public_key,
      );

      if (publicKeyPair >= 0) {
        publicKeyToAccounts[publicKeyPair].accounts = result.value;
      } else {
        publicKeyToAccounts.push({
          publicKey: keyPair.public_key,
          accounts: result.value,
        });
      }
    }
  });

  return publicKeyToAccounts;
};

export const setPublicKeyToAccounts = async (
  publicKeyToAccounts: Ref<PublicKeyAccounts[]>,
  keyPairs: KeyPair[],
  mirrorNodeBaseURL: string,
) => {
  publicKeyToAccounts.value = [];

  for (const { public_key } of keyPairs) {
    let next: string | null = null;

    do {
      const { accounts, nextUrl } = await getAccountIds(mirrorNodeBaseURL, public_key, next);
      next = nextUrl;

      const publicKeyPair = publicKeyToAccounts.value.findIndex(
        pkToAcc => pkToAcc.publicKey === public_key,
      );

      if (publicKeyPair >= 0) {
        publicKeyToAccounts.value[publicKeyPair].accounts?.push(...(accounts || []));
      } else {
        publicKeyToAccounts.value.push({
          publicKey: public_key,
          accounts: accounts || [],
        });
      }
      publicKeyToAccounts.value = [...publicKeyToAccounts.value];
    } while (next);
  }
};

export const setupSafeNetwork = async (
  userId: string,
  setNetwork: (network: string | undefined) => Promise<void>,
) => {
  const { data } = await safeAwait(getStoredClaim(userId, SELECTED_NETWORK));
  await safeAwait(setNetwork(data));
};

/* Computations */
export const getSecretHashesFromKeys = (keys: KeyPair[]): string[] => {
  const secretHashes: string[] = [];

  keys.forEach(key => {
    if (key.secret_hash && !secretHashes.includes(key.secret_hash))
      secretHashes.push(key.secret_hash);
  });

  return secretHashes;
};

export const getKeysFromSecretHash = async (
  keys: KeyPair[],
  secretHash: string[],
): Promise<KeyPair[]> => {
  const keysWithSecretHash: KeyPair[] = [];

  for (const key of keys.filter(k => k.secret_hash)) {
    if (!key.secret_hash) continue;

    const matchedHash = await compareHash([...secretHash].toString(), key.secret_hash);

    if (matchedHash) keysWithSecretHash.push(key);
  }

  return keysWithSecretHash;
};

export const getSecretHashFromUploadedKeys = async (
  recoveryPhrase: RecoveryPhrase,
  keys: IUserKey[],
) => {
  const allHashes: string[] = [];
  for (const key of keys) {
    if (key.mnemonicHash && !allHashes.includes(key.mnemonicHash)) {
      allHashes.push(key.mnemonicHash);
    }
  }
  return await compareDataToHashes([...recoveryPhrase.words].toString(), allHashes);
};

export const getNickname = (publicKey: string, keyPairs: KeyPair[]): string | undefined => {
  const keyPair = keyPairs.find(kp => kp.public_key === publicKey);
  return keyPair?.nickname || undefined;
};

export const getNicknameById = (id: string, keyPairs: KeyPair[]): string | undefined => {
  const keyPair = keyPairs.find(kp => kp.id === id);
  return keyPair?.nickname || undefined;
};

export const flattenAccountIds = (
  publicKeyToAccounts: PublicKeyAccounts[],
  withDeleted = false,
): string[] => {
  const accountIds: string[] = [];

  publicKeyToAccounts.forEach(pkToAcc => {
    pkToAcc.accounts
      .filter(acc => acc.account !== null && (withDeleted ? true : !acc.deleted))
      .sort((a, b) => {
        // If both balances are null, they are considered equal
        if (a.balance === null && b.balance === null) return 0;

        // If a's balance is null, it should come after b
        if (a.balance === null) return 1;

        // If b's balance is null, it should come after a
        if (b.balance === null) return -1;

        // If both balances exist but are null numbers, they are considered equal
        if (a.balance.balance === null && b.balance.balance === null) return 0;

        // If a's balance is null, it should come after b
        if (a.balance.balance === null) return 1;

        // If b's balance is null, it should come after a
        if (b.balance.balance === null) return -1;

        // Both balances are numbers, compare them in descending order
        return b.balance.balance - a.balance.balance;
      })
      .forEach(acc => {
        acc.account && accountIds.push(acc.account);
      });
  });

  return accountIds;
};

/* Organization */
export const getConnectedOrganization = async (
  organization: Organization,
  user: PersonalUser | null,
): Promise<ConnectedOrganization> => {
  if (!isUserLoggedIn(user)) {
    throw Error('Login to select organization');
  }

  let isActive = false;
  try {
    isActive = await healthCheck(organization.serverUrl);
  } catch (error) {
    console.log(error);
  }

  const inactiveServer: ConnectedOrganization = {
    ...organization,
    isServerActive: false,
    loginRequired: false,
  };

  const activeloginRequired: ConnectedOrganization = {
    ...organization,
    isServerActive: true,
    loginRequired: true,
  };

  if (!isActive) {
    return inactiveServer;
  }

  let shouldSignIn = true;
  try {
    shouldSignIn = await shouldSignInOrganization(user.id, organization.id);
  } catch (error) {
    console.log(error);
  }

  if (shouldSignIn) {
    return activeloginRequired;
  }

  try {
    const { id, email, admin, passwordTemporary, secretHashes, userKeys } = await getUserState(
      organization.serverUrl,
    );

    const connectedOrganization: ConnectedOrganization = {
      ...organization,
      isServerActive: isActive,
      loginRequired: false,
      userId: id,
      email,
      admin,
      isPasswordTemporary: passwordTemporary,
      secretHashes,
      userKeys,
    };

    return connectedOrganization;
  } catch {
    return activeloginRequired;
  }
};

export const afterOrganizationSelection = async (
  user: PersonalUser | null,
  organization: Ref<ConnectedOrganization | null>,
  keyPairs: Ref<KeyPair[]>,
  router: Router,
) => {
  await updateKeyPairs(keyPairs, user, organization.value);
  await nextTick();

  if (!organization.value) {
    navigateToPreviousRoute(router);
    return;
  }

  if (!isOrganizationActive(organization.value)) {
    organization.value = null;

    await updateKeyPairs(keyPairs, user, organization.value);
    await nextTick();

    navigateToPreviousRoute(router);
    return;
  }

  if (isLoggedOutOrganization(organization.value)) {
    router.push({ name: 'organizationLogin' });
    return;
  }

  if (
    isLoggedInOrganization(organization.value) &&
    accountSetupRequired(organization.value, keyPairs.value)
  ) {
    router.push({ name: 'accountSetup' });
    return;
  }

  navigateToPreviousRoute(router);
};

export const refetchUserState = async (organization: Ref<ConnectedOrganization | null>) => {
  if (!organization || !isLoggedInOrganization(organization.value)) return;

  try {
    const { id, email, admin, userKeys, secretHashes, passwordTemporary } = await getUserState(
      organization.value.serverUrl,
    );

    organization.value.userId = id;
    organization.value.email = email;
    organization.value.admin = admin;
    organization.value.userKeys = userKeys;
    organization.value.secretHashes = secretHashes;
    organization.value.isPasswordTemporary = passwordTemporary;
  } catch {
    const activeloginRequired: ConnectedOrganization = {
      id: organization.value.id,
      nickname: organization.value.nickname,
      serverUrl: organization.value.serverUrl,
      key: organization.value.key,
      isServerActive: true,
      loginRequired: true,
    };
    organization.value = activeloginRequired;
  }
};

export const getConnectedOrganizations = async (user: PersonalUser | null) => {
  const organizations = await getOrganizations();
  const connectedOrganizations: ConnectedOrganization[] = [];

  const results = await Promise.allSettled(
    organizations.map(organization => getConnectedOrganization(organization, user)),
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      connectedOrganizations.push(result.value);
    }
  });

  return connectedOrganizations;
};

export const getOrganizationJwtTokens = async (
  user: PersonalUser | null,
): Promise<OrganizationTokens> => {
  if (isUserLoggedIn(user)) {
    const organizationTokens = await getOrganizationTokens(user.id);
    return organizationTokens.reduce<OrganizationTokens>((acc, token) => {
      acc[token.organization_id] = token.jwtToken;
      return acc;
    }, {});
  }
  return {};
};

export const setSessionStorageTokens = (
  organizations: Organization[],
  organizationTokens: OrganizationTokens,
) => {
  for (const organization of organizations) {
    const token = organizationTokens[organization.id]?.trim();
    if (token && token.length > 0) {
      sessionStorage.setItem(
        `${SESSION_STORAGE_AUTH_TOKEN_PREFIX}${new URL(organization.serverUrl).origin}`,
        token,
      );
    }
  }
};

export const deleteOrganizationConnection = async (
  organizationId: string,
  user: PersonalUser | null,
) => {
  if (!isUserLoggedIn(user)) {
    throw Error('User is not logged in');
  }

  await deleteOrganizationCredentials(organizationId, user.id);
  await deleteOrganization(organizationId);
};

export const toggleAuthTokenInSessionStorage = (
  serverUrl: string,
  token: string,
  remove: boolean = false,
) => {
  const origin = new URL(serverUrl).origin;
  if (remove) {
    sessionStorage.removeItem(`${SESSION_STORAGE_AUTH_TOKEN_PREFIX}${origin}`);
    return;
  }
  sessionStorage.setItem(`${SESSION_STORAGE_AUTH_TOKEN_PREFIX}${origin}`, token);
};

export const getAuthTokenFromSessionStorage = (serverUrl: string): string | null => {
  const origin = new URL(serverUrl).origin;
  return sessionStorage.getItem(`${SESSION_STORAGE_AUTH_TOKEN_PREFIX}${origin}`);
};

const navigateToPreviousRoute = (router: Router) => {
  const currentRoute = router.currentRoute.value;
  if (router.previousPath) {
    currentRoute.path !== router.previousPath && router.push(router.previousPath);
  } else {
    currentRoute.name !== 'transactions' && router.push({ name: 'transactions' });
  }
};
