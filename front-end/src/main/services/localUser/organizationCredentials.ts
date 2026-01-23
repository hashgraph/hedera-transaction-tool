import { safeStorage } from 'electron';
import { getPrismaClient } from '@main/db/prisma';

import { Organization, OrganizationCredentials } from '@prisma/client';
import { jwtDecode } from 'jwt-decode';

import { login } from '@main/services/organization/auth';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

import { decrypt, encrypt } from '@main/utils/crypto';

/* Returns the organization that the user is connected to */
export const getOrganizationTokens = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    const orgs = await prisma.organizationCredentials.findMany({
      where: { user_id },
      select: {
        organization_id: true,
        jwtToken: true,
      },
    });

    return orgs || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

/* Returns the organizations that the user should sign into */
export const organizationsToSignIn = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    const credentials = await prisma.organizationCredentials.findMany({
      where: { user_id },
      include: {
        organization: true,
      },
    });

    const finalCredentials: typeof credentials = [];

    for (let i = 0; i < credentials.length; i++) {
      if (await organizationCredentialsInvalid(credentials[i]))
        finalCredentials.push(credentials[i]);
    }

    return finalCredentials;
  } catch (error) {
    console.log(error);
    return [];
  }
};

/* Returns whether the user should sign in a specific organization */
export const shouldSignInOrganization = async (user_id: string, organization_id: string) => {
  const prisma = getPrismaClient();

  try {
    const org = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
      include: {
        organization: true,
      },
    });

    return await organizationCredentialsInvalid(org);
  } catch {
    return true;
  }
};

/* Returns the access token of a user for an organization */
export const getAccessToken = async (serverUrl: string) => {
  const prisma = getPrismaClient();

  try {
    const credentials = await prisma.organizationCredentials.findFirst({
      where: { organization: { serverUrl } },
    });
    if (!credentials) return null;
    return credentials.jwtToken || null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

/* Returns the current user of an organization */
export const getCurrentUser = async (organizationServerUrl: string) => {
  const token = await getAccessToken(organizationServerUrl);
  if (!token) return null;

  try {
    const decoded: any = jwtDecode(token);
    return decoded;
  } catch {
    return null;
  }
};

/* Returns credentials for organization */
export const getOrganizationCredentials = async (
  organization_id: string,
  user_id: string,
  decryptPassword: string | null,
) => {
  const prisma = getPrismaClient();

  try {
    const credentials = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
    });

    if (!credentials) return null;

    const password = await decryptData(credentials.password, decryptPassword);

    return {
      ...credentials,
      password,
    };
  } catch (error) {
    console.log(error);
    return null;
  }
};

/* Returns whether organization credentials exists */
export const organizationCredentialsExists = async (organization_id: string, user_id: string) => {
  const prisma = getPrismaClient();

  try {
    return (
      (await prisma.organizationCredentials.count({
        where: { user_id, organization_id },
      })) > 0
    );
  } catch (error) {
    console.log(error);
    return false;
  }
};

/* Adds a new organization credentials to the user */
export const addOrganizationCredentials = async (
  email: string,
  password: string,
  organization_id: string,
  user_id: string,
  jwtToken: string,
  encryptPassword: string | null,
  updateIfExists: boolean = false,
) => {
  const prisma = getPrismaClient();

  if (updateIfExists) {
    const exists = await organizationCredentialsExists(organization_id, user_id);

    if (exists) {
      await updateOrganizationCredentials(
        organization_id,
        user_id,
        email,
        password,
        jwtToken,
        encryptPassword,
      );
      return;
    }
  }

  try {
    password = await encryptData(password, encryptPassword);

    await prisma.organizationCredentials.create({
      data: {
        email,
        password,
        jwtToken,
        organization_id,
        user_id,
      },
    });

    return true;
  } catch (error) {
    console.log(error);
    throw new Error('Failed to add organization credentials');
  }
};

/* Updates the organization credentials */
export const updateOrganizationCredentials = async (
  organization_id: string,
  user_id: string,
  email?: string,
  password?: string | null,
  jwtToken?: string | null,
  encryptPassword?: string | null,
) => {
  const prisma = getPrismaClient();

  try {
    if (password) {
      password = await encryptData(password, encryptPassword);
    }

    const credentials = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
    });

    if (!credentials) {
      console.log('User credentials for this organization not found');
      return false;
    }

    await prisma.organizationCredentials.update({
      where: { id: credentials.id },
      data: {
        email: email || credentials.email,
        password: password !== undefined ? password : credentials.password,
        jwtToken: jwtToken !== undefined ? jwtToken : credentials.jwtToken,
      },
    });

    return true;
  } catch (error) {
    console.log(error);
    throw new Error('Failed to update organization credentials');
  }
};

/* Deletes the organization credentials */
export const deleteOrganizationCredentials = async (organization_id: string, user_id: string) => {
  const prisma = getPrismaClient();

  try {
    await prisma.organizationCredentials.deleteMany({
      where: { user_id, organization_id },
    });

    return true;
  } catch (error) {
    console.log(error);
    throw new Error('Failed to delete organization credentials');
  }
};

/* Tries to auto sign in to all organizations that should sign in */
export const tryAutoSignIn = async (user_id: string, decryptPassword: string | null) => {
  const prisma = getPrismaClient();

  const invalidCredentials = await organizationsToSignIn(user_id);

  const failedLogins: Organization[] = [];

  for (let i = 0; i < invalidCredentials.length; i++) {
    const invalidCredential = invalidCredentials[i];

    let password = '';
    try {
      password = await decryptData(invalidCredential.password, decryptPassword);
    } catch {
      throw new Error('Incorrect decryption password');
    }

    try {
      const { accessToken } = await login(
        invalidCredential.organization.serverUrl,
        invalidCredential.email,
        password,
      );

      await prisma.organizationCredentials.update({
        where: { id: invalidCredential.id },
        data: { jwtToken: accessToken },
      });
    } catch {
      failedLogins.push(invalidCredential.organization);
    }
  }

  return failedLogins;
};

/* Encrypt data */
async function encryptData(data: string, encryptPassword?: string | null) {
  const useKeychain = await getUseKeychainClaim();

  if (useKeychain) {
    const passwordBuffer = safeStorage.encryptString(data);
    return passwordBuffer.toString('base64');
  } else if (encryptPassword) {
    return encrypt(data, encryptPassword);
  } else {
    throw new Error('Password is required to store sensitive data');
  }
}

/* Decrypt data */
export async function decryptData(data: string, decryptPassword?: string | null) {
  const useKeychain = await getUseKeychainClaim();
  if (useKeychain) {
    const buffer = Buffer.from(data, 'base64');
    return safeStorage.decryptString(buffer);
  } else if (decryptPassword) {
    return decrypt(data, decryptPassword);
  } else {
    throw new Error('Password is required to decrypt sensitive');
  }
}

/* Validate organization credentials */
export async function organizationCredentialsInvalid(
  org?: (OrganizationCredentials & { organization: Organization }) | null,
) {
  if (!org) return true;

  if (org.password.length === 0 || org.email.length === 0) return true;

  const token = await getAccessToken(org.organization.serverUrl);
  if (!token) return true;

  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) return true;
  } catch {
    return true;
  }

  return false;
}
