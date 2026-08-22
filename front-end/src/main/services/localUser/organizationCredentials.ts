import { safeStorage } from 'electron';
import { getPrismaClient } from '@main/db/prisma';

import { Organization, OrganizationCredentials } from '@prisma/client';
import { jwtDecode } from 'jwt-decode';

import { login } from '@main/services/organization/auth';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

import { createLogger } from '@main/modules/logger';
import { decrypt, encrypt, isLegacyBlob } from '@main/utils/crypto';

const logger = createLogger('main.organizationCredentials');

/* Returns the organization that the user is connected to */
export const getOrganizationTokens = async (user_id: string, decryptPassword: string | null) => {
  const prisma = getPrismaClient();

  try {
    const orgs = await prisma.organizationCredentials.findMany({
      where: { user_id },
      select: {
        id: true,
        organization_id: true,
        jwtToken: true,
      },
    });
    const result: { organization_id: string; jwtToken: string | null }[] = [];
    for (const o of orgs) {
      result.push({
        organization_id: o.organization_id,
        jwtToken: await decryptMigrateJwtToken(o, decryptPassword),
      });
    }
    return result;

  } catch (error) {
    logger.error('Failed to get organization tokens', { error });
    return [];
  }
};

/* Returns the organizations that the user should sign into */
export const organizationsToSignIn = async (user_id: string, decryptPassword: string | null) => {
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
      if (await organizationCredentialsInvalid(credentials[i], decryptPassword))
        finalCredentials.push(credentials[i]);
    }

    return finalCredentials;
  } catch (error) {
    logger.error('Failed to get organizations to sign in', { error });
    return [];
  }
};

/* Returns whether the user should sign in a specific organization */
export const shouldSignInOrganization = async (user_id: string, organization_id: string, decryptPassword: string | null) => {
  const prisma = getPrismaClient();

  try {
    const org = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
      include: {
        organization: true,
      },
    });

    return await organizationCredentialsInvalid(org, decryptPassword);
  } catch {
    return true;
  }
};

/* Returns the (encrypted) access token of a user for an organization */
export const getAccessToken = async (serverUrl: string, decryptPassword: string | null) => {
  const prisma = getPrismaClient();

  try {
    const credentials = await prisma.organizationCredentials.findFirst({
      where: { organization: { serverUrl } },
    });
    if (!credentials) return null;
    return await decryptMigrateJwtToken(credentials, decryptPassword);
  } catch (error) {
    logger.error('Failed to get access token', { error });
    return null;
  }
};

/* Returns the current user of an organization */
export const getCurrentUser = async (organizationServerUrl: string, decryptPassword: string | null) => {
  const token = await getAccessToken(organizationServerUrl, decryptPassword);
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

    const password = await decryptMigratePassword(credentials, decryptPassword);
    const jwtToken = await decryptMigrateJwtToken(credentials, decryptPassword);

    return {
      ...credentials,
      password,
      jwtToken,
    };
  } catch (error) {
    logger.error('Failed to get organization credentials', { error });
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
    logger.error('Failed to check organization credentials existence', { error });
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
    jwtToken = await encryptData(jwtToken, encryptPassword);

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
    logger.error('Failed to add organization credentials', { error });
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
  passwordIsEncrypted: boolean = false,
) => {
  const prisma = getPrismaClient();

  try {
    if (password && !passwordIsEncrypted) {
      password = await encryptData(password, encryptPassword);
    }

    if (jwtToken && !passwordIsEncrypted) {
      jwtToken = await encryptData(jwtToken, encryptPassword);
    }

    const credentials = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
    });

    if (!credentials) {
      logger.warn('User credentials for this organization not found');
      return false;
    }

    await prisma.organizationCredentials.update({
      where: { id: credentials.id },
      data: {
        email: email || credentials.email,
        password: password ?? credentials.password,
        jwtToken: jwtToken ?? credentials.jwtToken,
      },
    });

    return true;
  } catch (error) {
    logger.error('Failed to update organization credentials', { error });
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
    logger.error('Failed to delete organization credentials', { error });
    throw new Error('Failed to delete organization credentials');
  }
};

/* Tries to auto sign in to all organizations that should sign in */
export const tryAutoSignIn = async (user_id: string, decryptPassword: string | null) => {
  const prisma = getPrismaClient();

  const invalidCredentials = await organizationsToSignIn(user_id, decryptPassword);

  const failedLogins: Organization[] = [];

  for (let i = 0; i < invalidCredentials.length; i++) {
    const invalidCredential = invalidCredentials[i];

    let password = '';
    try {
      password = await decryptMigratePassword(
        invalidCredential,
        decryptPassword,
      );
    } catch {
      throw new Error('Incorrect decryption password');
    }

    try {
      const { accessToken } = await login(
        invalidCredential.organization.serverUrl,
        invalidCredential.email,
        password,
      );
      const encryptedAccessToken = await encryptData(accessToken, decryptPassword);

      await prisma.organizationCredentials.update({
        where: { id: invalidCredential.id },
        data: { jwtToken: encryptedAccessToken },
      });
    } catch {
      failedLogins.push(invalidCredential.organization);
    }
  }

  return failedLogins;
};

// Surfaces keychain / personal-password failures up front so callers can abort
// before triggering irreversible side effects (e.g. the backend password rotation).
export const encryptOrganizationPassword = async (
  password: string,
  encryptPassword?: string | null,
) => {
  if (!password) {
    throw new Error('Password is required to encrypt');
  }

  let useKeychain = false;
  try {
    useKeychain = await getUseKeychainClaim();
  } catch (error) {
    logger.error('Failed to encrypt organization password', { error });
    throw new Error('Keychain access denied or unavailable', { cause: error });
  }

  if (!useKeychain && !encryptPassword) {
    logger.warn('encryptOrganizationPassword called without a viable encryption method', {
      useKeychain,
    });
    throw new Error('No encryption method available');
  }

  try {
    if (useKeychain) {
      const buffer = safeStorage.encryptString(password);
      return buffer.toString('base64');
    }
    return await encrypt(password, encryptPassword as string);
  } catch (error) {
    logger.error('Failed to encrypt organization password', { error, useKeychain });
    if (useKeychain) {
      throw new Error('Keychain access denied or unavailable', { cause: error });
    }
    throw new Error('Failed to encrypt with application password', { cause: error });
  }
};

/* Encrypt data */
async function encryptData(data: string, encryptPassword?: string | null) {
  const useKeychain = await getUseKeychainClaim();

  if (useKeychain) {
    const passwordBuffer = safeStorage.encryptString(data);
    return passwordBuffer.toString('base64');
  } else if (encryptPassword) {
    return await encrypt(data, encryptPassword);
  } else {
    throw new Error('Password is required to store sensitive data');
  }
}

/* Decrypt data */
export async function decryptData(
  data: string,
  decryptPassword: string | null,
) {
  // if no data was stored (password cleared), just return empty string
  if (data.length === 0) {
    return '';
  }

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

/* Decrypt credentials password. Update its encryption if needed. */
export async function decryptMigratePassword(
  credential: { id: string, password: string },
  decryptPassword: string | null,
) {
  // if password was cleared, just return empty string
  if (credential.password.length === 0) {
    return '';
  }

  const useKeychain = await getUseKeychainClaim();
  if (useKeychain) {
    const buffer = Buffer.from(credential.password, 'base64');
    return safeStorage.decryptString(buffer);
  } else if (decryptPassword) {
    const decrypted = await decrypt(credential.password, decryptPassword);
    if (isLegacyBlob(credential.password)) {
      try {
        await getPrismaClient().organizationCredentials.update({
          where: { id: credential.id },
          data: { password: await encrypt(decrypted, decryptPassword) },
        });
      } catch {
        // migration failure is non-fatal
      }
    }
    return decrypted;
  } else {
    throw new Error('Password is required to decrypt sensitive');
  }
}

/* Decrypt credentials password. Update its encryption if needed. */
export async function decryptMigrateJwtToken(
  credential: { id: string; jwtToken: string | null},
  decryptPassword: string | null,
) {
  // if token is null, returns null
  if (credential.jwtToken === null) {
    return null;
  }

  if (isLegacyBlob(credential.jwtToken)) {
    // JWT token is not encrypted => we encrypt it
    try {
      await getPrismaClient().organizationCredentials.update({
        where: { id: credential.id },
        data: { jwtToken: await encryptData(credential.jwtToken, decryptPassword) },
      });
    } catch {
      // migration failure is non-fatal
    }
    return credential.jwtToken;
  } else {
    return decryptData(credential.jwtToken, decryptPassword);
  }
}

/* Validate organization credentials */
export async function organizationCredentialsInvalid(
  org: (OrganizationCredentials & { organization: Organization }) | null,
  decryptPassword: string | null,
) {
  if (!org) return true;

  if (org.password.length === 0 || org.email.length === 0) return true;

  const token = await getAccessToken(org.organization.serverUrl, decryptPassword);
  if (!token) return true;

  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) return true;
  } catch {
    return true;
  }

  return false;
}
