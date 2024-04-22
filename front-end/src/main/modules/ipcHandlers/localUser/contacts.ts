import { ipcMain } from 'electron';

import { addContact, getContacts, removeContact, updateContact } from '@main/services/localUser';
import { AssociatedAccount, Contact, Prisma } from '@prisma/client';

const createChannelName = (...props) => ['contacts', ...props].join(':');

export default () => {
  /* Contacts */

  // Get contacts
  ipcMain.handle(createChannelName('getContacts'), (_e, userId: string) => getContacts(userId));

  // Add
  ipcMain.handle(
    createChannelName('addContact'),
    (_e, contact: Contact, associatedAccounts: AssociatedAccount[]) =>
      addContact(contact, associatedAccounts),
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
