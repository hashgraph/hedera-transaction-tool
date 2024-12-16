import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Contacts */
  createIPCChannel('contacts', [
    renameFunc(addContact, 'addContact'),
    renameFunc(getOrganizationContacts, 'getOrganizationContacts'),
    renameFunc(updateContact, 'updateContact'),
    renameFunc(removeContact, 'removeContact'),
  ]);
};
