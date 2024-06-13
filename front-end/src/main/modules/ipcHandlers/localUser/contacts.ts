import { ipcMain } from 'electron';

import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';
import { Prisma } from '@prisma/client';

const createChannelName = (...props) => ['contacts', ...props].join(':');

export default () => {
  /* Contacts */

  // Get Organization contacts
  ipcMain.handle(
    createChannelName('getOrganizationContacts'),
    (_e, userId: string, organizationId: string, organizationUserIdOwner: number) =>
      getOrganizationContacts(userId, organizationId, organizationUserIdOwner),
  );

  // Add
  ipcMain.handle(
    createChannelName('addContact'),
    (_e, contact: Prisma.ContactUncheckedCreateInput) => addContact(contact),
  );

  // Update
  ipcMain.handle(
    createChannelName('updateContact'),
    (_e, contactId: string, userId: string, contact: Prisma.ContactUncheckedUpdateInput) =>
      updateContact(contactId, userId, contact),
  );

  // Remove
  ipcMain.handle(createChannelName('removeContact'), (_e, userId: string, contactId: string) =>
    removeContact(userId, contactId),
  );
};
