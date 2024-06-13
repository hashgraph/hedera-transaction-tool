import { session, CookiesSetDetails } from 'electron';
import { getPrismaClient } from '@main/db/prisma';

import { Organization, OrganizationCredentials } from '@prisma/client';
import { jwtDecode } from 'jwt-decode';

import { decrypt, encrypt } from '@main/utils/crypto';

import { login } from '@main/services/organization/auth';

/* Returns the organization that the user is connected to */
export const getConnectedOrganizations = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    const orgs = await prisma.organizationCredentials.findMany({
      where: { user_id },
      select: {
        organization: true,
      },
    });

    return orgs === null ? [] : orgs.map(org => org.organization);
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
  } catch (error) {
    return true;
  }
};

/* Returns the access token of a user for an organization */
export const getAccessToken = async (organizationServerUrl: string) => {
  try {
    const url = new URL(organizationServerUrl);

    const ses = session.fromPartition('persist:main');
    const authCookies = (
      await ses.cookies.get({
        name: 'Authentication',
      })
    ).filter(cookie => cookie.domain === url.hostname);

    return authCookies.length > 0 ? authCookies[0].value : null;
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
  } catch (error) {
    return null;
  }
};

/* Returns credentials for organization */
export const getOrganizationCredentials = async (organization_id: string, user_id: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

/* Returns whether organization credentials exists */
export const organizationCredentialsExists = async (organization_id: string, user_id: string) => {
  const prisma = getPrismaClient();

  try {
    return (await prisma.organizationCredentials.count({
      where: { user_id, organization_id },
    })) > 0
      ? true
      : false;
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
  encryptPassword: string,
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
        encryptPassword,
      );
      return;
    }
  }

  try {
    password = encrypt(password, encryptPassword);

    await prisma.organizationCredentials.create({
      data: {
        email,
        password,
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
  password?: string,
  encryptPassword?: string,
) => {
  const prisma = getPrismaClient();

  try {
    if (password) {
      if (!encryptPassword) {
        throw new Error('No encryption password provided');
      }
      password = encrypt(password, encryptPassword);
    }

    const credentials = await prisma.organizationCredentials.findFirst({
      where: { user_id, organization_id },
    });

    if (!credentials) {
      throw new Error('User credentials for this organization not found');
    }

    await prisma.organizationCredentials.update({
      where: { id: credentials.id },
      data: {
        email: email || credentials.email,
        password: password || credentials.password,
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

export const decryptCredentialPassword = async (
  credentials: OrganizationCredentials,
  decryptPassword: string,
) => {
  try {
    return decrypt(credentials.password, decryptPassword);
  } catch (error) {
    console.log(error);
    throw new Error('Failed to decrypt credential');
  }
};

/* Tries to auto sign in to all organizations that should sign in */
export const tryAutoSignIn = async (user_id: string, decryptPassword: string) => {
  const ses = session.fromPartition('persist:main');

  const invalidCredentials = await organizationsToSignIn(user_id);

  const failedLogins: Organization[] = [];

  for (let i = 0; i < invalidCredentials.length; i++) {
    const invalidCredential = invalidCredentials[i];

    let password = '';
    try {
      password = await decryptCredentialPassword(invalidCredential, decryptPassword);
    } catch (error) {
      throw new Error('Incorrect decryption password');
    }

    try {
      const { cookie } = await login(
        invalidCredential.organization.serverUrl,
        invalidCredential.email,
        password,
      );

      if (cookie && cookie.length > 0) {
        ses.cookies.set(parseSetCookie(invalidCredential.organization.serverUrl, cookie[0]));
      }
    } catch (error) {
      failedLogins.push(invalidCredential.organization);
    }
  }

  return failedLogins;
};

function parseSetCookie(url: string, setCookieString: string) {
  const parts = setCookieString.split(';').map(part => part.trim());

  const [namePart, ...otherParts] = parts;
  const [name, value] = namePart.split('=');

  const cookie: CookiesSetDetails = {
    name,
    url,
    value,
    path: '/',
    httpOnly: true,
    sameSite: 'no_restriction',
  };

  otherParts.forEach(part => {
    part = part.toLowerCase().trim();
    if (part.startsWith('path=')) {
      cookie.path = part.split('=')[1];
    } else if (part === 'httponly') {
      cookie.httpOnly = true;
    } else if (part.startsWith('expires=')) {
      const expirationDate = new Date(part.split('=')[1]);
      cookie.expirationDate = expirationDate.getTime() / 1000;
    } else if (part.startsWith('samesite=')) {
      const value = part.split('=')[1];
      cookie.sameSite = value === 'none' ? 'no_restriction' : 'lax';
    }
  });

  cookie.secure = cookie.sameSite === 'no_restriction';

  return cookie;
}

/* Validate organization credentials */
async function organizationCredentialsInvalid(
  org?: (OrganizationCredentials & { organization: Organization }) | null,
) {
  if (!org) return true;

  if (org.password.length === 0 || org.email.length === 0) return true;

  const token = await getAccessToken(org.organization.serverUrl);
  if (!token) return true;

  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) return true;
  } catch (error) {
    return true;
  }

  return false;
}
