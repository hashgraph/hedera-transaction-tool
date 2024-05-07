<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { HederaAccount } from '@prisma/client';

import { PublicKey } from '@hashgraph/sdk';

import { AccountInfo, Contact } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import { addContact, updateContact } from '@renderer/services/contactsService';
import { getAccountsByPublicKeys } from '@renderer/services/mirrorNodeDataService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  contact: Contact;
  linkedAccounts: HederaAccount[];
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const contacts = useContactsStore();

/* State */
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const publicKeyToAccounts = ref<{ [key: string]: AccountInfo[] }>({});

/* Emits */
defineEmits(['update:remove']);

/* Handlers */
const handleStartNicknameEdit = () => {
  isNicknameInputShown.value = true;

  setTimeout(() => {
    if (nicknameInputRef.value) {
      if (nicknameInputRef.value.inputRef) {
        nicknameInputRef.value.inputRef.value = props.contact.nickname || props.contact.user.email;
      }
      nicknameInputRef.value?.inputRef?.focus();
    }
  }, 100);
};

const handleChangeNickname = async () => {
  isNicknameInputShown.value = false;

  if (!isUserLoggedIn(user.personal) || !isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('User is not logged in an organization');
  }

  const contactData = {
    nickname: nicknameInputRef.value?.inputRef?.value || '',
    user_id: user.personal.id,
    organization_user_id_owner: user.selectedOrganization.userId,
    organization_user_id: props.contact.user.id,
    organization_id: user.selectedOrganization.id,
  };

  if (props.contact.nicknameId) {
    await updateContact(props.contact.nicknameId, user.personal.id, contactData);
  } else {
    await addContact(contactData);
  }

  await contacts.fetch();
};

const handleAccountsLookup = async () => {
  publicKeyToAccounts.value = await getAccountsByPublicKeys(
    network.mirrorNodeBaseURL,
    props.contact.userKeys.map(key => key.publicKey),
  );
};

/* Hooks */
onBeforeMount(async () => {
  await handleAccountsLookup();
});

/* Watchers */
watch(
  () => props.contact,
  async () => {
    await handleAccountsLookup();
  },
);
</script>
<template>
  <div class="flex-between-centered flex-wrap gap-3">
    <div class="d-flex align-items-center flex-wrap gap-3">
      <AppInput
        v-if="isNicknameInputShown"
        ref="nicknameInputRef"
        @blur="handleChangeNickname"
        :filled="true"
      />
      <p
        v-if="!isNicknameInputShown"
        class="text-title text-semi-bold py-3"
        @dblclick="handleStartNicknameEdit"
      >
        {{ contact.nickname || contact.user.email }}

        <span
          class="bi bi-pencil-square text-primary text-main cursor-pointer ms-1"
          @click="handleStartNicknameEdit"
        ></span>
      </p>
    </div>
    <div class="d-flex gap-3">
      <AppButton
        v-if="isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin"
        class="min-w-unset"
        color="danger"
        @click="$emit('update:remove')"
        ><span class="bi bi-trash"></span> Remove</AppButton
      >
    </div>
  </div>
  <hr class="separator my-4" />
  <div class="fill-remaining overflow-x-hidden pe-3">
    <div class="mt-4 row">
      <div class="col-5">
        <p class="text-small text-semi-bold">Email</p>
      </div>
      <div class="col-7">
        <p class="text-small overflow-hidden">
          {{ contact.user.email }}
        </p>
      </div>
    </div>
    <template v-for="key in contact.userKeys" :key="key.publicKey">
      <div class="mt-4 row">
        <div class="col-5">
          <p class="text-small text-semi-bold">Public Key</p>
        </div>
        <div class="col-7">
          <p class="text-secondary text-small overflow-hidden">
            {{ PublicKey.fromString(key.publicKey).toStringRaw() }}
          </p>
          <p class="text-small text-semi-bold text-pink mt-3">
            {{ PublicKey.fromString(key.publicKey)._key._type }}
          </p>
        </div>
      </div>
      <Transition name="fade" mode="out-in">
        <div
          v-if="publicKeyToAccounts[key.publicKey] && publicKeyToAccounts[key.publicKey].length > 0"
          class="mt-4 row"
        >
          <div class="col-5">
            <p class="text-small text-semi-bold">Associated Accounts</p>
          </div>
          <div class="col-7">
            <ul class="d-flex flex-wrap gap-3">
              <template
                v-for="account in publicKeyToAccounts[key.publicKey]"
                :key="`${key.publicKey}${account.account}`"
              >
                <li class="text-center associated-account-badge-bg rounded py-2 px-3">
                  <p class="text-small text-secondary">
                    {{ account.account }}
                    <span
                      v-if="
                        (
                          linkedAccounts
                            .find(a => a.account_id === account.account)
                            ?.nickname?.trim() || ''
                        ).length > 0
                      "
                      >({{
                        linkedAccounts.find(a => a.account_id === account.account)?.nickname
                      }})</span
                    >
                  </p>
                </li>
              </template>
            </ul>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
