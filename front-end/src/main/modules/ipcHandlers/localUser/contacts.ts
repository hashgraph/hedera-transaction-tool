import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Contacts */
  createIPCChannel('contacts', [addContact, getOrganizationContacts, updateContact, removeContact]);
};
