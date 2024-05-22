import { ref } from 'vue';
import { defineStore } from 'pinia';

import useUserStore from './storeUser';

import { getUserKeys, getUsers } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { getOrganizationContacts } from '@renderer/services/contactsService';
import { Contact } from '@main/shared/interfaces';

const useContactsStore = defineStore('contacts', () => {
  const user = useUserStore();

  /* State */
  const contacts = ref<Contact[]>([]);

  /* Actions */
  async function fetch() {
    contacts.value = [];

    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      if (user.selectedOrganization.isPasswordTemporary) return;

      const serverUrl = user.selectedOrganization.serverUrl;
      const users = await getUsers(serverUrl);

      const orgContacts = await getOrganizationContacts(
        user.personal.id,
        user.selectedOrganization.id,
        user.selectedOrganization.userId,
      );

      const newContacts: Contact[] = [];

      const result = await Promise.allSettled(users.map(u => getUserKeys(serverUrl, u.id)));

      result.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          newContacts.push({
            user: users[i],
            userKeys: r.value,
            nickname: orgContacts.find(c => c.organization_user_id === users[i].id)?.nickname || '',
            nicknameId: orgContacts.find(c => c.organization_user_id === users[i].id)?.id || null,
          });
        }
      });

      contacts.value = newContacts;
    }
  }

  function getContact(userId: number) {
    return contacts.value.find(c => c.user.id === userId);
  }

  function getNickname(userId: number) {
    return contacts.value.find(c => c.user.id === userId)?.nickname || '';
  }

  return {
    contacts,
    fetch,
    getNickname,
    getContact,
  };
});

export default useContactsStore;
