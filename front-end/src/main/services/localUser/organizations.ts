import { getPrismaClient } from '@main/db';
import { Prisma } from '@prisma/client';

export const getOrganizations = async (user_id?: string) => {
  const prisma = getPrismaClient();

  try {
    if (user_id) {
      const orgs = await prisma.organizationCredentials.findMany({
        where: { user_id },
        select: {
          organization: true,
        },
      });

      console.log(orgs);
      return orgs === null ? [] : orgs.map(org => org.organization);
    } else {
      return await prisma.organization.findMany();
    }
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addOrganization = async (organization: Prisma.OrganizationCreateInput) => {
  const prisma = getPrismaClient();
  return await prisma.organization.create({ data: organization });
};

export const removeOrganization = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.organization.delete({
    where: {
      id,
    },
  });

  return true;
};

export const updateOrganization = async (
  id: string,
  {
    nickname,
    serverUrl,
    key,
  }: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
) => {
  const prisma = getPrismaClient();

  await prisma.organization.updateMany({
    where: {
      id,
    },
    data: {
      nickname,
      serverUrl,
      key,
    },
  });

  return true;
};
