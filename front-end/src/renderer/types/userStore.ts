import { Mnemonic } from '@hashgraph/sdk';
import { AccountInfo, IUserKey } from '@main/shared/interfaces';
import { Organization } from '@prisma/client';

type LoggedOutUser = {
  isLoggedIn: false;
};

type LoggedInUser = {
  isLoggedIn: true;
  email: string;
  password: string | null;
};

export type PersonalUser = LoggedOutUser | LoggedInUser;

type OrganizationInactiveServer = {
  isServerActive: false;
  loginRequired: false;
};

type OrganizationActiveServer = {
  isServerActive: true;
  loginRequired: boolean;
};

type LoggedOutOrganization = {
  isServerActive: true;
  loginRequired: true;
};

export type LoggedInOrganization = {
  isServerActive: true;
  loginRequired: false;
  userId: number;
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
