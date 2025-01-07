import type { AccountInfo, IUserKey } from '@main/shared/interfaces';
import type { Organization } from '@prisma/client';

import { Mnemonic } from '@hashgraph/sdk';

type LoggedOutUser = {
  isLoggedIn: false;
};

export type LoggedInUser = {
  isLoggedIn: true;
  id: string;
  email: string;
  password: string | null;
  useKeychain: boolean;
};

export type LoggedInUserWithPassword = {
  isLoggedIn: true;
  id: string;
  email: string;
  password: string;
  passwordExpiresAt: Date;
  useKeychain: boolean;
};

export type PersonalUser = LoggedOutUser | LoggedInUser | LoggedInUserWithPassword;

type OrganizationLoading = {
  isLoading: true;
};

export type OrganizationLoaded = {
  isLoading: false;
};

type OrganizationInactiveServer = {
  isLoading: false;
  isServerActive: false;
  loginRequired: false;
};

export type OrganizationActiveServer = {
  isLoading: false;
  isServerActive: true;
  loginRequired: boolean;
};

export type LoggedOutOrganization = {
  isLoading: false;
  isServerActive: true;
  loginRequired: true;
};

export type LoggedInOrganization = {
  isLoading: false;
  isServerActive: true;
  loginRequired: false;
  userId: number;
  email: string;
  admin: boolean;
  isPasswordTemporary: boolean;
  userKeys: IUserKey[];
  secretHashes: string[];
};

export type ConnectedOrganization = Organization &
  (
    | OrganizationLoading
    | (OrganizationLoaded &
        (
          | OrganizationInactiveServer
          | (OrganizationActiveServer & (LoggedInOrganization | LoggedOutOrganization))
        ))
  );

export type OrganizationTokens = {
  [organizationId: string]: string | null;
};

export type PublicKeyAccounts = {
  publicKey: string;
  accounts: AccountInfo[];
};

export type RecoveryPhrase = {
  mnemonic: Mnemonic;
  words: string[];
  hash: string;
};
