import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getContacts, addContact, removeContact } from '@renderer/services/contactsService';
import { getAssociatedAccounts } from '@renderer/services/associatedAccountsService';
import useUserStore from './storeUser';

export interface Contact {
  id: string;
  user_id: string;
  key_name: string;
  public_key: string;
  organization: string;
  associated_accounts: AssociatedAccount[];
}

interface AssociatedAccount {
  id: string;
  contact_id: string;
  account_id: string;
}

const useContactsStore = defineStore('contacts', () => {
  const user = useUserStore();

  /* State */
  const contacts = ref<Contact[]>();

  /* Actions */
  async function fetch() {
    contacts.value = [];
    if (user.personal?.isLoggedIn) {
      const apiContacts = await getContacts(user.personal.id);
      let associatedAccounts = new Array<AssociatedAccount>();
      for (const contact of apiContacts) {
        associatedAccounts = await getAssociatedAccounts(contact.id);
        contacts.value.push({ ...contact, associated_accounts: associatedAccounts });
      }
    }
  }

  async function add(
    userId: string,
    keyName: string,
    publicKey: string,
    organization: string,
    associatedAccounts: string[],
  ) {
    await addContact(
      {
        id: '',
        user_id: userId,
        key_name: keyName,
        public_key: publicKey,
        organization,
        associated_accounts: [],
      },
      associatedAccounts.map(acc => {
        return { id: '', contact_id: '', account_id: acc };
      }),
    );
  }

  async function remove(userId: string, id: string) {
    await removeContact(userId, id);
  }

  return {
    contacts,
    add,
    remove,
    fetch,
  };
});

export default useContactsStore;
