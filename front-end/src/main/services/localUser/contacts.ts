import { getPrismaClient } from '@main/db/prisma';
import { Prisma } from '@prisma/client';

export async function getOrganizationContacts(
  user_id: string,
  organization_id: string,
  organization_user_id_owner: number,
) {
  const prisma = getPrismaClient();

  try {
    return await prisma.contact.findMany({
      where: {
        user_id,
        organization_id,
        organization_user_id_owner,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
}

export const addContact = async (contact: Prisma.ContactUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  const newContact = await prisma.contact.create({
    data: {
      ...contact,
      id: undefined,
    },
  });

  return newContact;
};

export const updateContact = async (
  contactId: string,
  userId: string,
  contact: Prisma.ContactUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.contact.updateMany({
    where: {
      id: contactId,
      user_id: userId,
    },
    data: {
      ...contact,
      user_id: userId,
    },
  });
};

export const removeContact = async (userId: string, contactId: string) => {
  const prisma = getPrismaClient();

  await prisma.contact.deleteMany({
    where: {
      id: contactId,
      user_id: userId,
    },
  });
};
