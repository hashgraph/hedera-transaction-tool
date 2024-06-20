import { Prisma } from '@prisma/client';
import { commonIPCHandler } from '@renderer/utils';

export const getOrganizationContacts = async (
  userId: string,
  organizationId: string,
  organizationUserIdOwner: number,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.contacts.getOrganizationContacts(
      userId,
      organizationId,
      organizationUserIdOwner,
    );
  }, 'Failed to get linked contacts');

export const addContact = async (contact: Prisma.ContactUncheckedCreateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.contacts.addContact(contact);
  }, 'Contact add failed');

export const updateContact = async (
  contactId: string,
  userId: string,
  contact: Prisma.ContactUncheckedUpdateInput,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.contacts.updateContact(contactId, userId, contact);
  }, 'Contact update failed');

export const removeContact = async (userId: string, contactId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.contacts.removeContact(userId, contactId);
  }, 'Contact removal failed');
