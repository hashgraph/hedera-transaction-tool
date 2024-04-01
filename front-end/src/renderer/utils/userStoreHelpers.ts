import { KeyPair, Organization, Prisma } from '@prisma/client';
import {
  ConnectedOrganization,
  LoggedInOrganization,
  LoggedOutOrganization,
  LoggedInUser,
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
} from '@renderer/types';

import { getKeyPairs, hashRecoveryPhrase } from '@renderer/services/keyPairService';
import { getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService';
import { storeKeyPair as storeKey } from '@renderer/services/keyPairService';
import { Mnemonic } from '@hashgraph/sdk';

/* Flags */
export const isUserLoggedIn = (user: PersonalUser | null): user is LoggedInUser => {
  return user !== null && user.isLoggedIn;
};

export const isOrganizationActive = (organization: ConnectedOrganization | null): boolean => {
  return organization !== null && organization.isServerActive;
};

export const isLoggedOutOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedOutOrganization => {
  return organization !== null && organization.isServerActive && organization.loginRequired;
};

export const isLoggedInOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedInOrganization => {
  return organization !== null && organization.isServerActive && !organization.loginRequired;
};

export const accountSetupRequired = (
  organization: ConnectedOrganization | null,
  localKeys: KeyPair[],
  localSecretHashes: string[],
) => {
  if (localSecretHashes.length === 0) return true;
  if (!organization || !isLoggedInOrganization(organization)) return false;

  if (organization.isPasswordTemporary) return true;
  if (organization.secretHashes.length === 0) return true;
  if (
    !organization.userKeys
      .filter(key => key.mnemonicHash)
      .every(key => localKeys.some(k => k.public_key === key.publicKey))
  )
    return true;

  return false;
};

/* Entity creation */
export const createPersonalUser = (id?: string, email?: string): PersonalUser =>
  id && email
    ? {
        isLoggedIn: true,
        id,
        email,
        password: null,
      }
    : { isLoggedIn: false };

export const createRecoveryPhrase = async (words: string[]): Promise<RecoveryPhrase> => {
  try {
    const mnemonic = await Mnemonic.fromWords(words);
    const hash = await hashRecoveryPhrase(words);

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
  secretHashes: string[],
  password: string,
) => {
  if (
    secretHashes.length > 0 &&
    keyPair.secret_hash &&
    !secretHashes.includes(keyPair.secret_hash)
  ) {
    throw Error('Different recovery phrase is used!');
  }

  await storeKey(keyPair, password);
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
      return 1;
    } else {
      return k1.index - k2.index;
    }
  });

  return keyPairs;
};

export const getPublicKeysToAccounts = async (keyPairs: KeyPair[], mirrorNodeBaseURL: string) => {
  const publicKeyToAccounts: PublicKeyAccounts[] = [];

  for (let i = 0; i < keyPairs.length; i++) {
    const keyPair = keyPairs[i];

    const publicKeyPair = publicKeyToAccounts.findIndex(
      pkToAcc => pkToAcc.publicKey === keyPair.public_key,
    );

    const accounts = await getAccountsByPublicKey(mirrorNodeBaseURL, keyPair.public_key);

    if (publicKeyPair >= 0) {
      publicKeyToAccounts[publicKeyPair].accounts = accounts;
    } else {
      publicKeyToAccounts.push({
        publicKey: keyPair.public_key,
        accounts: accounts,
      });
    }
  }

  return publicKeyToAccounts;
};

/* Computations */
export const getSecretHashesFromKeys = (keys: KeyPair[]): string[] => {
  const secretHashes: string[] = [];

  keys.forEach(key => {
    if (key.secret_hash) secretHashes.push(key.secret_hash);
  });

  return secretHashes;
};

export const getNickname = (publicKey: string, keyPairs: KeyPair[]): string | undefined => {
  const keyPair = keyPairs.find(kp => kp.public_key === publicKey);
  return keyPair?.nickname || undefined;
};
