import { getPrismaClient } from '@main/db';
import { AssociatedAccount, Contact, Prisma } from '@prisma/client';
import { createAssociatedAccount, removeAssociatedAccounts } from './associatedAccounts';

export const getContacts = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.contact.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addContact = async (contact: Contact, associatedAccounts: AssociatedAccount[]) => {
  const prisma = getPrismaClient();

  const contacts = await getContacts(contact.user_id);

  if (contacts.some(con => con.key_name === contact.key_name)) {
    throw new Error('Key Name already exists!');
  }

  // const newContact =
  const newContact = await prisma.contact.create({
    data: {
      user_id: contact.user_id,
      key_name: contact.key_name,
      public_key: contact.public_key,
      organization: contact.organization,
    },
  });

  for (const associatedAccount of associatedAccounts) {
    await createAssociatedAccount(associatedAccount.account_id, newContact.id);
  }

  console.log('finished contacts?');

  return await getContacts(contact.user_id);
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

  return await getContacts(userId);
};

export const removeContact = async (userId: string, contactId: string) => {
  const prisma = getPrismaClient();

  const contacts = await getContacts(userId);

  if (!contacts.some(con => con.id === contactId)) {
    throw new Error(`Contact not found!`);
  }

  // await removeAssociatedAccounts(contactId);

  await prisma.contact.deleteMany({
    where: {
      id: contactId,
      user_id: userId,
    },
  });

  return await getContacts(userId);
};
