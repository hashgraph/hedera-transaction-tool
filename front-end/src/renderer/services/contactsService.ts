import { Contact } from '@main/shared/interfaces';
import { Prisma, AssociatedAccount, ContactPublicKey } from '@prisma/client';
import { getMessageFromIPCError } from '@renderer/utils';

export const getPersonalContacts = async (userId: string) => {
  try {
    return await window.electronAPI.local.contacts.getPersonalContacts(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked contacts'));
  }
};

export const getOrganizationContacts = async (userId: string, organization: string) => {
  try {
    return await window.electronAPI.local.contacts.getOrganizationContacts(userId, organization);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked contacts'));
  }
};

export const addContact = async (
  contact: Contact,
  associatedAccounts: AssociatedAccount[],
  publicKeys: ContactPublicKey[],
) => {
  try {
    return await window.electronAPI.local.contacts.addContact(
      contact,
      associatedAccounts,
      publicKeys,
    );
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
