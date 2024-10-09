import { getPrismaClient } from '@main/db/prisma';
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

  if (
    (await prisma.organization.count({
      where: {
        serverUrl: organization.serverUrl,
      },
    })) > 0
  ) {
    throw new Error('Organization with this server URL already exists');
  }

  if (
    (await prisma.organization.count({
      where: {
        nickname: organization.nickname,
      },
    })) > 0
  ) {
    throw new Error('Organization with this nickname already exists');
  }

  return await prisma.organization.create({ data: organization });
};

export const removeOrganization = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.deleteMany({
    where: {
      organization_id: id,
    },
  });

  await prisma.contact.deleteMany({
    where: {
      organization_id: id,
    },
  });

  await prisma.organizationCredentials.deleteMany({
    where: {
      organization_id: id,
    },
  });

  await prisma.organization.delete({
    where: {
      id,
    },
  });

  return true;
};

export const updateOrganization = async (
  id: string,
  data: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
) => {
  const prisma = getPrismaClient();

  delete data.Contact;
  delete data.id;
  delete data.keyPairs;

  await prisma.organization.updateMany({
    where: {
      id,
    },
    data,
  });

  return true;
};
