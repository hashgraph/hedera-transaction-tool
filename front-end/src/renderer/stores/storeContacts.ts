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

      const users = await getUsers(user.selectedOrganization.serverUrl);

      const orgContacts = await getOrganizationContacts(
        user.personal.id,
        user.selectedOrganization.id,
        user.selectedOrganization.userId,
      );

      for (const orgUser of users) {
        const userKeys = await getUserKeys(user.selectedOrganization.serverUrl, orgUser.id);
        contacts.value.push({
          user: orgUser,
          userKeys: userKeys,
          nickname: orgContacts.find(c => c.organization_user_id === orgUser.id)?.nickname || '',
          nicknameId: orgContacts.find(c => c.organization_user_id === orgUser.id)?.id || null,
        });
      }
    }
  }

  return {
    contacts,
    fetch,
  };
});

export default useContactsStore;
