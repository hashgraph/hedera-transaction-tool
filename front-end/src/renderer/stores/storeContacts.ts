import type { Contact, IUserKey } from '@shared/interfaces';

import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from './storeUser';

import { getAllUserKeys, getUserKeys, getUsers } from '@renderer/services/organization';
import { getOrganizationContacts } from '@renderer/services/contactsService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';
import type { ConnectedOrganization, LoggedInOrganization, LoggedInUser } from '@renderer/types';

const useContactsStore = defineStore('contacts', () => {
  const user = useUserStore();

  /* State */
  const contacts = ref<Contact[]>([]);
  const fetching = ref(false);

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
  const loggedOrganization = computed(() => {
    let result: ConnectedOrganization | null;
    if (
      isUserLoggedIn(user.personal) &&
      isLoggedInOrganization(user.selectedOrganization) &&
      !user.selectedOrganization.isPasswordTemporary
    ) {
      result = user.selectedOrganization;
    } else {
      result = null;
    }
    return result;
  });

  /* Actions */
  async function fetch() {
    fetching.value = true;
    try {
      contacts.value = await loadContacts(user.personal as LoggedInUser, loggedOrganization.value);
    } finally {
      fetching.value = false;
    }
  }

  async function fetchUserKeys(userId: number) {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const keys = await getUserKeys(user.selectedOrganization.serverUrl, userId);

      const contactIndex = contacts.value.findIndex(c => c.user.id === userId);
      if (contactIndex === -1) return;

      contacts.value[contactIndex].userKeys = keys;
      contacts.value = [...contacts.value];
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

  /* Watch */
  watch(loggedOrganization, () => fetch(), { immediate: true });
  return {
    contacts,
    publicKeys,
    fetching,
    fetch,
    fetchUserKeys,
    getContact,
    getContactByPublicKey,
    getNickname,
  };
});

async function loadContacts(
  user: LoggedInUser,
  organization: (ConnectedOrganization & LoggedInOrganization) | null,
): Promise<Contact[]> {
  let result: Contact[];

  if (organization !== null) {
    const serverUrl = organization.serverUrl;
    const users = await getUsers(serverUrl);

    const orgContacts = await getOrganizationContacts(
      user.id,
      organization.id,
      organization.userId,
    );
    result = [];

    const allKeys = await getAllUserKeys(serverUrl);
    const userToKeys = new Map<number, IUserKey[]>();
    allKeys.forEach(k => {
      if (!userToKeys.has(k.userId)) userToKeys.set(k.userId, []);
      userToKeys.get(k.userId)?.push(k);
    });

    users.forEach(u => {
      const keys = userToKeys.get(u.id) || [];
      result.push({
        user: u,
        userKeys: keys,
        nickname: orgContacts.find(c => c.organization_user_id === u.id)?.nickname || '',
        nicknameId: orgContacts.find(c => c.organization_user_id === u.id)?.id || null,
      });
    });
  } else {
    result = [];
  }

  return Promise.resolve(result);
}

export default useContactsStore;
