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
};

export type LoggedInUserWithPassword = {
  isLoggedIn: true;
  id: string;
  email: string;
  password: string;
  passwordExpiresAt: Date;
};

export type PersonalUser = LoggedOutUser | LoggedInUser | LoggedInUserWithPassword;

type OrganizationInactiveServer = {
  isServerActive: false;
  loginRequired: false;
};

export type OrganizationActiveServer = {
  isServerActive: true;
  loginRequired: boolean;
};

export type LoggedOutOrganization = {
  isServerActive: true;
  loginRequired: true;
};

export type LoggedInOrganization = {
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
    | OrganizationInactiveServer
    | (OrganizationActiveServer & (LoggedInOrganization | LoggedOutOrganization))
  );

export type PublicKeyAccounts = {
  publicKey: string;
  accounts: AccountInfo[];
};

export type RecoveryPhrase = {
  mnemonic: Mnemonic;
  words: string[];
  hash: string;
};
