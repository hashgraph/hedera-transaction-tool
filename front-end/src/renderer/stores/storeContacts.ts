import type { Contact } from '@main/shared/interfaces';

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from './storeUser';

import { getUserKeys, getUsers } from '@renderer/services/organization';
import { getOrganizationContacts } from '@renderer/services/contactsService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

const useContactsStore = defineStore('contacts', () => {
  const user = useUserStore();

  /* State */
  const contacts = ref<Contact[]>([]);

  /* Computed */
  const publicKeys = computed(() => {
    const publicKeys: { publicKey: string; nickname: string }[] = [];

    contacts.value.forEach(c => {
      c.userKeys.forEach(k => {
        publicKeys.push({
          publicKey: k.publicKey,
          nickname: c.nickname,
        });
      });
    });

    return publicKeys;
  });

  /* Actions */
  async function fetch() {
    if (!isUserLoggedIn(user.personal)) return;

    if (isLoggedInOrganization(user.selectedOrganization)) {
      if (user.selectedOrganization.isPasswordTemporary) return;

      const serverUrl = user.selectedOrganization.serverUrl;
      const users = await getUsers(serverUrl);

      const orgContacts = await getOrganizationContacts(
        user.personal.id,
        user.selectedOrganization?.id,
        user.selectedOrganization?.userId,
      );
      const newContacts: Contact[] = [];

      const result = await Promise.allSettled(users.map(u => getUserKeys(serverUrl, u.id)));

      result.forEach((r, i) => {
        newContacts.push({
          user: users[i],
          userKeys: r.status === 'fulfilled' ? r.value : [],
          nickname: orgContacts.find(c => c.organization_user_id === users[i].id)?.nickname || '',
          nicknameId: orgContacts.find(c => c.organization_user_id === users[i].id)?.id || null,
        });
      });

      contacts.value = newContacts;
    } else {
      contacts.value = [];
    }
  }

  function getContact(userId: number) {
    return contacts.value.find(c => c.user.id === userId);
  }

  function getContactByPublicKey(publicKey: PublicKey | string) {
    publicKey = publicKey instanceof PublicKey ? publicKey.toStringRaw() : publicKey;
    return contacts.value.find(c => c.userKeys.find(k => k.publicKey === publicKey));
  }

  function getNickname(userId: number) {
    return contacts.value.find(c => c.user.id === userId)?.nickname || '';
  }

  return {
    contacts,
    publicKeys,
    fetch,
    getContact,
    getContactByPublicKey,
    getNickname,
  };
});

export default useContactsStore;
