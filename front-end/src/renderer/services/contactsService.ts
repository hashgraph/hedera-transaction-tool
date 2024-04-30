import { Prisma } from '@prisma/client';
import { getMessageFromIPCError } from '@renderer/utils';

export const getOrganizationContacts = async (
  userId: string,
  organizationId: string,
  organizationUserIdOwner: number,
) => {
  try {
    return await window.electronAPI.local.contacts.getOrganizationContacts(
      userId,
      organizationId,
      organizationUserIdOwner,
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked contacts'));
  }
};

export const addContact = async (contact: Prisma.ContactUncheckedCreateInput) => {
  try {
    return await window.electronAPI.local.contacts.addContact(contact);
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
