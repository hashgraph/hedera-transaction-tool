import { getPrismaClient } from '@main/db';
import { AssociatedAccount, Contact, ContactPublicKey, Prisma } from '@prisma/client';
import { createAssociatedAccount } from './associatedAccounts';
import { createContactPublicKey } from './contactPublicKeys';

export const getPersonalContacts = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.contact.findMany({
      where: {
        user_id: userId,
        organization: null,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export async function getOrganizationContacts(userId: string, organization: string) {
  const prisma = getPrismaClient();

  try {
    return await prisma.contact.findMany({
      where: {
        user_id: userId,
        organization: organization,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
}

export const addContact = async (
  contact: Contact,
  associatedAccounts: AssociatedAccount[],
  publicKeys: ContactPublicKey[],
) => {
  const prisma = getPrismaClient();

  const newContact = await prisma.contact.create({
    data: {
      user_id: contact.user_id,
      key_name: contact.key_name,
      email: contact.email,
      organization: contact.organization,
      organization_user_id: contact.organization_user_id,
    },
  });

  for (const associatedAccount of associatedAccounts) {
    console.log(associatedAccount.account_id);
    await createAssociatedAccount(associatedAccount.account_id, newContact.id);
  }

  for (const publicKey of publicKeys) {
    console.log(publicKey.public_key);
    await createContactPublicKey(publicKey.public_key, newContact.id);
  }

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

  // await removeAssociatedAccounts(contactId);

  await prisma.contact.deleteMany({
    where: {
      id: contactId,
      user_id: userId,
    },
  });
};
