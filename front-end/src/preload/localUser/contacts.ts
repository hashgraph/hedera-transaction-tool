import { ipcRenderer } from 'electron';

import { Contact, Prisma } from '@prisma/client';

export default {
  contacts: {
    getOrganizationContacts: (
      userId: string,
      organizationId: string,
      organizationUserIdOwner: number,
    ): Promise<Contact[]> =>
      ipcRenderer.invoke(
        'contacts:getOrganizationContacts',
        userId,
        organizationId,
        organizationUserIdOwner,
      ),
    addContact: (contact: Prisma.ContactUncheckedCreateInput): Promise<Contact> =>
      ipcRenderer.invoke('contacts:addContact', contact),
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
