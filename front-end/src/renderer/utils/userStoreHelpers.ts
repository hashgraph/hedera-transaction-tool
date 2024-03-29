import { Ref } from 'vue';
import { KeyPair, Organization } from '@prisma/client';
import { ConnectedOrganization, LoggedInOrganization, PersonalUser } from '@renderer/types';

export const getSecretHashesFromKeys = (keys: KeyPair[]): string[] => {
  const secretHashes: string[] = [];

  keys.forEach(key => {
    if (key.secret_hash) secretHashes.push(key.secret_hash);
  });

  return secretHashes;
};

export const isOrganizationActive = (organization: ConnectedOrganization | null): boolean => {
  return organization !== null && organization.isServerActive;
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

export const handleLogin = (
  personalUserRef: Ref<PersonalUser | null>,
  id: string,
  email: string,
) => {
  personalUserRef.value = {
    isLoggedIn: true,
    id,
    email,
    password: null,
  };
};

export const handleLogout = (personalUserRef: Ref<PersonalUser | null>) => {
  personalUserRef.value = {
    isLoggedIn: false,
  };
};
