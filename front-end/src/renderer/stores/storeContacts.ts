import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
  getOrganizationContacts,
  getPersonalContacts,
  addContact,
  removeContact,
  updateContact,
} from '@renderer/services/contactsService';
import { getAssociatedAccounts } from '@renderer/services/associatedAccountsService';
import useUserStore from './storeUser';
import {
  getBackendContactPublicKeys,
  getBackendOrganizationContacts,
} from '@renderer/services/organization/contacts';
import {
  getContactPublicKeys,
  addContactPublicKey,
} from '@renderer/services/contactPublicKeysService';
import { AssociatedAccount, Contact, ContactPublicKey } from '@main/shared/interfaces';

const useContactsStore = defineStore('contacts', () => {
  const user = useUserStore();

  /* State */
  const contacts = ref<Contact[]>(new Array<Contact>());

  /* Actions */
  async function fetch() {
    await new Promise(r => setTimeout(r, 2000));
    if (user.personal?.isLoggedIn) {
      if (user.selectedOrganization?.isServerActive && !user.selectedOrganization.loginRequired) {
        const backendContacts = await getBackendOrganizationContacts(
          user.selectedOrganization.serverUrl,
        );
        const localContacts = await getOrganizationContacts(
          user.personal.id,
          user.selectedOrganization.nickname,
        );
        for (const contact of backendContacts) {
          let localContact = localContacts.find(lc => lc.organization_user_id == contact.id);
          if (contact?.id == user.selectedOrganization.userId) {
            continue;
          } else if (!localContact) {
            localContact = await add(
              user.personal.id,
              contact.email,
              contact.email,
              user.selectedOrganization.nickname,
              contact.id.toString(),
              [],
              [],
            );
          }
          const backendPublicKeys = await getBackendContactPublicKeys(
            user.selectedOrganization.serverUrl,
            contact.id,
          );
          const localPublicKeys = await getContactPublicKeys(localContact.id);
          for (const publicKey of backendPublicKeys) {
            if (!localPublicKeys.find(lpk => lpk.public_key == publicKey.publicKey)) {
              await addContactPublicKey(publicKey.publicKey, localContact.id);
            }
          }
          const orgContacts = await getOrganizationContacts(
            user.personal.id,
            user.selectedOrganization.nickname,
          );
          contacts.value = new Array<Contact>();
          for (const contact of orgContacts) {
            const publicKeys = await getContactPublicKeys(contact.id);
            contacts.value.push({
              ...contact,
              associated_accounts: [],
              public_keys: publicKeys ? publicKeys : new Array<ContactPublicKey>(),
            });
          }
        }
      } else {
        contacts.value = [];
        const apiContacts = await getPersonalContacts(user.personal.id);
        let associatedAccounts = new Array<AssociatedAccount>();
        let publicKeys = new Array<ContactPublicKey>();
        for (const contact of apiContacts) {
          associatedAccounts = await getAssociatedAccounts(contact.id);
          publicKeys = await getContactPublicKeys(contact.id);
          contacts.value.push({
            ...contact,
            associated_accounts: associatedAccounts,
            public_keys: publicKeys ? publicKeys : new Array<ContactPublicKey>(),
          });
        }
      }
    }
  }

  async function add(
    userId: string,
    keyName: string,
    email: string,
    organization: string | null,
    organizationUserId: string | null,
    associatedAccounts: string[],
    publicKeys: string[],
  ) {
    return await addContact(
      {
        id: '',
        user_id: userId,
        key_name: keyName,
        email,
        public_keys: [],
        organization,
        associated_accounts: [],
        organization_user_id: organizationUserId,
      },
      associatedAccounts.map(acc => {
        return { id: '', contact_id: '', account_id: acc };
      }),
      publicKeys.map(pk => {
        return { id: '', contact_id: '', public_key: pk };
      }),
    );
  }

  async function remove(userId: string, id: string) {
    await removeContact(userId, id);
  }

  async function edit(id: string, userId: string, keyName: string) {
    await updateContact(id, userId, { key_name: keyName });
  }

  return {
    contacts,
    add,
    remove,
    edit,
    fetch,
  };
});

export default useContactsStore;
