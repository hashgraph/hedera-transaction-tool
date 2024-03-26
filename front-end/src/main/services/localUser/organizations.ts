import { getPrismaClient } from '@main/db';
import { Prisma } from '@prisma/client';

export const getOrganizations = async () => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organization.findMany();
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const getOrganization = async (id: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organization.findFirst({ where: { id } });
  } catch (error) {
    console.log(error);
    return null;
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
