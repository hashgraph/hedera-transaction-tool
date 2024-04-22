import { ipcRenderer } from 'electron';

import { Contact, AssociatedAccount, Prisma, ContactPublicKey } from '@prisma/client';

export default {
  contacts: {
    getPersonalContacts: (userId: string): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:getPersonalContacts', userId),
    getOrganizationContacts: (userId: string, organization: string): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:getOrganizationContacts', userId, organization),
    addContact: (
      contact: Contact,
      associatedAccounts: AssociatedAccount[],
      publicKeys: ContactPublicKey[],
    ): Promise<Contact> =>
      ipcRenderer.invoke('contacts:addContact', contact, associatedAccounts, publicKeys),
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
