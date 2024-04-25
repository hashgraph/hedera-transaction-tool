import { ipcMain } from 'electron';

import {
  addContact,
  getPersonalContacts,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser';
import { AssociatedAccount, Contact, ContactPublicKey, Prisma } from '@prisma/client';

const createChannelName = (...props) => ['contacts', ...props].join(':');

export default () => {
  /* Contacts */

  // Get Personal contacts
  ipcMain.handle(createChannelName('getPersonalContacts'), (_e, userId: string) =>
    getPersonalContacts(userId),
  );

  // Get Organization contacts
  ipcMain.handle(
    createChannelName('getOrganizationContacts'),
    (_e, userId: string, organization: string) => getOrganizationContacts(userId, organization),
  );

  // Add
  ipcMain.handle(
    createChannelName('addContact'),
    (
      _e,
      contact: Contact,
      associatedAccounts: AssociatedAccount[],
      publicKeys: ContactPublicKey[],
    ) => addContact(contact, associatedAccounts, publicKeys),
  );

  // Update
  ipcMain.handle(
    createChannelName('updateContact'),
    (_e, contactId: string, userId: string, contact: Prisma.HederaFileUncheckedUpdateInput) =>
      updateContact(contactId, userId, contact),
  );

  // Remove
  ipcMain.handle(createChannelName('removeContact'), (_e, userId: string, contactId: string) =>
    removeContact(userId, contactId),
  );
};
