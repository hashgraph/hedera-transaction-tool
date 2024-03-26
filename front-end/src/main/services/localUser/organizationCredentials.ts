import { getPrismaClient } from '@main/db';

import { Prisma } from '@prisma/client';

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
