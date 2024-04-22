import { ipcRenderer } from 'electron';

import { Contact, AssociatedAccount, Prisma } from '@prisma/client';

export default {
  contacts: {
    getContacts: (userId: string): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:getContacts', userId),
    addContact: (contact: Contact, associatedAccounts: AssociatedAccount[]): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:addContact', contact, associatedAccounts),
    updateContact: (
      contactId: string,
      userId: string,
      contact: Prisma.ContactUncheckedUpdateInput,
    ): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:updateContact', contactId, userId, contact),
    removeContact: (userId: string, contactId: string): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:removeContact', userId, contactId),
  },
};
