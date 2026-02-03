import type { Ref } from 'vue';
import type { KeyPair, Organization } from '@prisma/client';
import type { IUserKey } from '@shared/interfaces';
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
  OrganizationActiveServer,
  OrganizationLoaded,
} from '@renderer/types';

import { Prisma } from '@prisma/client';
import { Mnemonic } from '@hashgraph/sdk';

import { SESSION_STORAGE_AUTH_TOKEN_PREFIX } from '@shared/constants';

import {
  getUserState,
  healthCheck,
  updateKey as updateOrganizationKey,
  uploadKey,
} from '@renderer/services/organization';
import {
  storeKeyPair as storeKey,
  getKeyPairs,
  restorePrivateKey,
} from '@renderer/services/keyPairService';
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
import { get as getStoredMnemonics } from '@renderer/services/mnemonicService';

import { safeAwait } from './safeAwait';
import { getErrorMessage, throwError } from '.';
import * as pks from '@renderer/services/publicKeyMappingService';
import type { AccountByPublicKeyCache } from '@renderer/caches/mirrorNode/AccountByPublicKeyCache.ts';

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

export const isOrganizationActive = (
  organization: ConnectedOrganization | null,
): organization is ConnectedOrganization & OrganizationLoaded & OrganizationActiveServer => {
  return organization !== null && !organization.isLoading && organization.isServerActive;
};

export const isLoggedOutOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedOutOrganization => {
  return (
    organization !== null &&
    !organization.isLoading &&
    organization.isServerActive &&
    organization.loginRequired
  );
};

export function assertIsLoggedInOrganization(
  organization: ConnectedOrganization | null,
): asserts organization is Organization & LoggedInOrganization {
  if (!isLoggedInOrganization(organization)) throw Error('User is not logged in an organization');
}

export const isLoggedInOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedInOrganization => {
  return (
    organization !== null &&
    !organization.isLoading &&
    organization.isServerActive &&
    !organization.loginRequired
  );
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
export const createRecoveryPhrase = async (words: string[]): Promise<RecoveryPhrase> => {
  try {
    const mnemonic = await Mnemonic.fromWords(words);
    const hash = await hashData(getRecoveryPhraseHashValue(words), true);

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
      keyPair.secret_hash = await hashData(getRecoveryPhraseHashValue(mnemonic), true);
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
  if (!isUserLoggedIn(user)) {
    return [];
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

export const getPublicKeyToAccounts = async (
  publicKeyToAccounts: PublicKeyAccounts[],
  keyPairs: KeyPair[],
  mirrorNodeBaseURL: string,
  accountByKeyCache: AccountByPublicKeyCache,
) => {
  for (const { public_key } of keyPairs) {
    //@ts-ignore - data cannot infer type
    const { data } = await safeAwait(accountByKeyCache.lookup(public_key, mirrorNodeBaseURL));
    if (data) {
      const publicKeyPair = publicKeyToAccounts.findIndex(
        pkToAcc => pkToAcc.publicKey === public_key,
      );

      if (publicKeyPair >= 0) {
        publicKeyToAccounts[publicKeyPair].accounts?.push(...(data || []));
      } else {
        publicKeyToAccounts.push({
          publicKey: public_key,
          accounts: data || [],
        });
      }
    }
  }

  return [...publicKeyToAccounts];
};

export const getMnemonics = async (user: PersonalUser | null) => {
  if (!isUserLoggedIn(user)) {
    return [];
  }
  return await getStoredMnemonics({ where: { user_id: user.id } });
};

/* Computations */
export const getSecretHashesFromKeys = (keys: KeyPair[]): string[] => {
  const secretHashes = new Set<string>();

  keys.forEach(key => {
    if (key.secret_hash) secretHashes.add(key.secret_hash);
  });

  return Array.from(secretHashes);
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

export const getSecretHashFromLocalKeys = async (
  recoveryPhrase: RecoveryPhrase,
  keys: KeyPair[],
) => {
  const allHashes: string[] = [];
  for (const key of keys) {
    if (key.secret_hash && !allHashes.includes(key.secret_hash)) allHashes.push(key.secret_hash);
  }
  return await compareDataToHashes(getRecoveryPhraseHashValue(recoveryPhrase.words), allHashes);
};

export const getSecretHashFromUploadedKeys = async (
  recoveryPhrase: RecoveryPhrase,
  keys: IUserKey[],
): Promise<string | null> => {
  const allHashes: string[] = [];
  for (const key of keys) {
    if (key.mnemonicHash && !allHashes.includes(key.mnemonicHash)) {
      allHashes.push(key.mnemonicHash);
    }
  }
  return await compareDataToHashes(getRecoveryPhraseHashValue(recoveryPhrase.words), allHashes);
};

export const getUploadedKeysFromRecoveryPhrase = async (
  recoveryPhrase: RecoveryPhrase,
  keys: IUserKey[],
): Promise<IUserKey[]> => {
  const userKeys: IUserKey[] = [];
  for (const key of keys) {
    if (key.mnemonicHash) {
      const match = await compareHash(
        getRecoveryPhraseHashValue(recoveryPhrase.words),
        key.mnemonicHash,
      );
      if (match) {
        userKeys.push(key);
      }
    }
  }
  return userKeys;
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

export const getRecoveryPhraseHashValue = (words: string[]) => {
  return [...words].toString();
};

/* Organization */
export const getConnectedOrganization = async (
  organization: Organization | null,
  user: PersonalUser | null,
): Promise<ConnectedOrganization | null> => {
  assertUserLoggedIn(user);

  if (!organization) {
    return null;
  }

  const inactiveOrg: ConnectedOrganization = {
    ...organization,
    isLoading: false,
    isServerActive: false,
    loginRequired: false,
  };

  try {
    const isActive = await healthCheck(organization.serverUrl);

    if (!isActive) {
      return inactiveOrg;
    }
  } catch (error) {
    console.log(error);
    return inactiveOrg;
  }

  const activeLoginRequired: ConnectedOrganization = {
    ...organization,
    isLoading: false,
    isServerActive: true,
    loginRequired: true,
  };

  try {
    const shouldSignIn = await shouldSignInOrganization(user.id, organization.id);

    if (shouldSignIn) {
      return activeLoginRequired;
    }
  } catch (error) {
    console.log(error);
    return activeLoginRequired;
  }

  try {
    const { id, email, admin, passwordTemporary, secretHashes, userKeys } = await getUserState(
      organization.serverUrl,
    );

    const connectedOrganization: ConnectedOrganization = {
      ...organization,
      isLoading: false,
      isServerActive: true,
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
    return activeLoginRequired;
  }
};

export const refetchUserState = async (organization: ConnectedOrganization | null) => {
  if (!organization || !isLoggedInOrganization(organization)) return organization;

  try {
    const { id, email, admin, userKeys, secretHashes, passwordTemporary } = await getUserState(
      organization.serverUrl,
    );

    organization.userId = id;
    organization.email = email;
    organization.admin = admin;
    organization.userKeys = userKeys;
    organization.secretHashes = secretHashes;
    organization.isPasswordTemporary = passwordTemporary;
    return organization;
  } catch {
    const activeloginRequired: ConnectedOrganization = {
      id: organization.id,
      nickname: organization.nickname,
      serverUrl: organization.serverUrl,
      key: organization.key,
      isLoading: false,
      isServerActive: true,
      loginRequired: true,
    };
    return activeloginRequired;
  }
};

export const updateConnectedOrganizations = async (
  organizationsRef: Ref<ConnectedOrganization[]>,
  user: PersonalUser | null,
) => {
  const organizations = await getOrganizations();
  organizationsRef.value = organizations.map(org => ({ ...org, isLoading: true }));

  const result = await Promise.allSettled(
    organizations.map(async (organization, index) => {
      const connectedOrg = await getConnectedOrganization(organization, user);
      if (connectedOrg) {
        organizationsRef.value[index] = connectedOrg;
        organizationsRef.value = [...organizationsRef.value];
      }
    }),
  );

  result.forEach(res => res.status === 'rejected' && console.log(res.reason));
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

export const restoreOrganizationKeys = async (
  organization: ConnectedOrganization,
  recoveryPhrase: RecoveryPhrase | null,
  personalUser: PersonalUser | null,
  storedKeyPairs: KeyPair[],
  currentPhraseOnly: boolean,
) => {
  assertUserLoggedIn(personalUser);
  assertIsLoggedInOrganization(organization);

  if (!recoveryPhrase) {
    throw new Error('Recovery phrase is required to restore keys');
  }

  const personalKeys = currentPhraseOnly ? [] : await getLocalKeyPairs(personalUser, null);

  const failedRestoreMessages: string[] = [];
  const keys: {
    publicKey: string;
    privateKey: string;
    index: number;
    mnemonicHash: string;
    encrypted: boolean;
  }[] = [];

  const alreadyUploadedHash = await getSecretHashFromUploadedKeys(
    recoveryPhrase,
    organization.userKeys,
  );

  for (const organizationKey of organization.userKeys) {
    const alreadyAddedForRestore = keys.some(k => k.publicKey === organizationKey.publicKey);
    const keyIsStored = storedKeyPairs.some(kp => kp.public_key === organizationKey.publicKey);
    const keyFromPersonalKeys = personalKeys.find(
      pk => pk.public_key === organizationKey.publicKey,
    );

    try {
      if (
        !keyIsStored &&
        !alreadyAddedForRestore &&
        organizationKey.mnemonicHash &&
        organizationKey.index != null
      ) {
        const key = {
          publicKey: '',
          privateKey: '',
          index: organizationKey.index,
          mnemonicHash: organizationKey.mnemonicHash,
          encrypted: false,
        };

        if (organizationKey.mnemonicHash === alreadyUploadedHash) {
          const privateKey = await restorePrivateKey(
            recoveryPhrase.words,
            '',
            organizationKey.index,
            'ED25519',
          );
          key.publicKey = privateKey.publicKey.toStringRaw();
          key.privateKey = privateKey.toStringRaw();
        } else if (!currentPhraseOnly && keyFromPersonalKeys) {
          key.publicKey = keyFromPersonalKeys.public_key;
          key.privateKey = keyFromPersonalKeys.private_key;
          key.encrypted = true;
        }

        if (key.publicKey !== '') {
          if (organizationKey.publicKey !== key.publicKey) {
            throwError(
              `Public key mismatch for organization key: expected ${organizationKey.publicKey}, received ${key.publicKey}`,
            );
          }

          keys.push(key);
        }
      }
    } catch (error) {
      failedRestoreMessages.push(
        getErrorMessage(error, `Failed to restore key at index ${organizationKey.index}`),
      );
    }
  }

  return { keys, failedRestoreMessages };
};

export const safeDuplicateUploadKey = async (
  organization: ConnectedOrganization,
  key: { publicKey: string; index?: number; mnemonicHash?: string },
) => {
  if (isLoggedInOrganization(organization)) {
    const keyUploaded = organization.userKeys.some(k => k.publicKey === key.publicKey);

    if (!keyUploaded) {
      await uploadKey(organization.serverUrl, organization.userId, key);
    }
  }
};

export const updateOrganizationKeysHash = async (
  organization: ConnectedOrganization,
  recoveryPhrase: RecoveryPhrase | null,
) => {
  assertIsLoggedInOrganization(organization);

  if (!recoveryPhrase) {
    throw new Error('Recovery phrase is required to restore keys');
  }

  const keys = await getUploadedKeysFromRecoveryPhrase(recoveryPhrase, organization.userKeys);

  for (const key of keys) {
    await updateOrganizationKey(
      organization.serverUrl,
      organization.userId,
      key.id,
      recoveryPhrase.hash,
    );
  }
};

export const getAllPublicKeyMappings = async () => {
  return await pks.getPublicKeys();
};

export const getPublicKeyMapping = async (publicKey: string) => {
  return await pks.getPublicKey(publicKey);
};

export const addPublicKeyMapping = async (publicKey: string, nickname: string) => {
  const existingKey = await getPublicKeyMapping(publicKey);
  if (existingKey) {
    throw new Error('This public key has already been added!');
  }
  return await pks.addPublicKey(publicKey, nickname);
};

export const updatePublicKeyNickname = async (
  id: string,
  publicKey: string,
  newNickname: string,
) => {
  const existingKey = await getPublicKeyMapping(publicKey);
  if (existingKey?.nickname === newNickname) {
    throw new Error('You need to set a different nickname than the previous one!');
  }
  return await pks.editPublicKeyNickname(id, newNickname);
};
