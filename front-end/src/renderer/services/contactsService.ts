import { Prisma, AssociatedAccount } from '@prisma/client';
import { Contact } from '@renderer/stores/storeContacts';
import { getMessageFromIPCError } from '@renderer/utils';

export const getContacts = async (userId: string) => {
  try {
    return await window.electronAPI.local.contacts.getContacts(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked contacts'));
  }
};

export const addContact = async (contact: Contact, associatedAccounts: AssociatedAccount[]) => {
  try {
    console.log(associatedAccounts);
    return await window.electronAPI.local.contacts.addContact(contact, associatedAccounts);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact add failed'));
  }
};

export const updateContact = async (
  contactId: string,
  userId: string,
  contact: Prisma.ContactUncheckedUpdateInput,
) => {
  try {
    return await window.electronAPI.local.contacts.updateContact(contactId, userId, contact);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact update failed'));
  }
};

export const removeContact = async (userId: string, contactId: string) => {
  try {
    return await window.electronAPI.local.contacts.removeContact(userId, contactId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Contact removal failed'));
  }
};
