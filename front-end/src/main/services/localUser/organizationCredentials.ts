import { getPrismaClient } from '@main/db';

import { OrganizationCredentials, Prisma } from '@prisma/client';
import { jwtDecode } from 'jwt-decode';

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

function credentialsValid(credentials?: OrganizationCredentials | null) {
  if (!credentials) return false;

  if (
    credentials.password.length === 0 ||
    credentials.email.length === 0 ||
    !credentials.jwtToken ||
    credentials.jwtToken.length === 0
  )
    return false;

  const jwtPayload = jwtDecode(credentials.jwtToken);

  if (!jwtPayload.exp) return false;

  if (new Date(jwtPayload.exp * 1000) < new Date()) return false;

  return true;
}
