import { getPrismaClient } from '@main/db';

import { OrganizationCredentials } from '@prisma/client';
import { jwtDecode } from 'jwt-decode';

import { encrypt } from '@main/utils/crypto';

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
    let credentials = await prisma.organizationCredentials.findMany({
      where: { user_id },
      include: {
        organization: true,
      },
    });

    credentials = credentials.filter(cr => !credentialsValid(cr));

    return credentials.map(cr => ({
      organization: cr.organization,
      credential_id: cr.id,
      email: cr.email,
    }));
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
    });

    return !credentialsValid(org);
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
  encryptPassword: string,
) => {
  const prisma = getPrismaClient();

  try {
    password = encrypt(password, encryptPassword);

    await prisma.organizationCredentials.create({
      data: {
        email,
        password,
        organization_id,
        user_id,
        jwtToken,
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
  jwtToken?: string,
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
        jwtToken: jwtToken || credentials.jwtToken,
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

function credentialsValid(credentials?: OrganizationCredentials | null) {
  if (!credentials) return false;

  if (
    credentials.password.length === 0 ||
    credentials.email.length === 0 ||
    !credentials.jwtToken ||
    credentials.jwtToken.length === 0
  )
    return false;

  try {
    const jwtPayload = jwtDecode(credentials.jwtToken);
    if (!jwtPayload.exp) return false;
    if (new Date(jwtPayload.exp * 1000) < new Date()) return false;
  } catch (error) {
    return false;
  }

  return true;
}
