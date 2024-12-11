<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import type { AccountInfo, Contact } from '@main/shared/interfaces';

import { onBeforeMount, ref, watch } from 'vue';
import { useToast } from 'vue-toast-notification';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import { addContact, updateContact } from '@renderer/services/contactsService';
import { getAccountsByPublicKeysParallel } from '@renderer/services/mirrorNodeDataService';
import { signUp } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import ContactDetailsAssociatedAccounts from '@renderer/components/Contacts/ContactDetailsAssociatedAccounts.vue';
import ContactDetailsLinkedAccounts from '@renderer/components/Contacts/ContactDetailsLinkedAccounts.vue';

/* Props */
const props = defineProps<{
  contact: Contact;
  linkedAccounts: HederaAccount[];
}>();

/* Composables */
const toast = useToast();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const contacts = useContactsStore();

/* State */
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const publicKeyToAccounts = ref<{ [key: string]: AccountInfo[] }>({});

/* Emits */
const emit = defineEmits(['update:linkedAccounts', 'update:remove']);

/* Handlers */
const handleStartNicknameEdit = () => {
  isNicknameInputShown.value = true;

  setTimeout(() => {
    if (nicknameInputRef.value) {
      if (nicknameInputRef.value.inputRef) {
        nicknameInputRef.value.inputRef.value = props.contact.nickname || '';
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

  const contact = contacts.contacts.find(c => c.user.id === props.contact.user.id);
  if (contact) {
    contact.nickname = contactData.nickname;
  }

  await contacts.fetch();
};

const handleAccountsLookup = async () => {
  publicKeyToAccounts.value = await getAccountsByPublicKeysParallel(
    network.mirrorNodeBaseURL,
    props.contact.userKeys.map(key => key.publicKey),
  );
};

const handleResend = async () => {
  const email = props.contact.user.email;
  try {
    if (user.selectedOrganization?.serverUrl) {
      await signUp(user.selectedOrganization?.serverUrl, email);
    }
    toast.success('Email sent successfully');
  } catch (error: unknown) {
    toast.error('Error while sending email. Please try again.');
  }
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
        data-testid="input-change-nickname"
        @blur="handleChangeNickname"
        :filled="true"
      />
      <p
        v-if="!isNicknameInputShown"
        class="text-title text-semi-bold py-3"
        @dblclick="handleStartNicknameEdit"
      >
        {{ contact.nickname || 'None' }}

        <span
          class="bi bi-pencil-square text-primary text-main cursor-pointer ms-1"
          data-testid="span-change-nickname"
          @click="handleStartNicknameEdit"
        ></span>
      </p>
    </div>
    <div
      v-if="
        isLoggedInOrganization(user.selectedOrganization) &&
        user.selectedOrganization.admin &&
        contact.user.id !== user.selectedOrganization.userId
      "
      class="d-flex gap-3"
    >
      <AppButton
        v-if="contact.user.status === 'NEW'"
        data-testid="button-resend-email-from-contact-list"
        class="min-w-unset"
        color="secondary"
        @click="handleResend"
      >
        Resend email
      </AppButton>
      <AppButton
        data-testid="button-remove-account-from-contact-list"
        class="min-w-unset"
        color="danger"
        @click="$emit('update:remove')"
        ><span class="bi bi-trash"></span> Remove</AppButton
      >
    </div>
  </div>
  <div class="mt-4 row">
    <div class="col-5">
      <p class="text-main text-semi-bold">Email</p>
    </div>
    <div class="col-7">
      <p class="text-secondary overflow-hidden" data-testid="p-contact-email">
        {{ contact.user.email }}
      </p>
    </div>
  </div>
  <hr class="separator my-4" />
  <div class="fill-remaining overflow-x-hidden pe-3">
    <template v-for="(key, index) in contact.userKeys" :key="key.publicKey">
      <div class="p-4">
        <hr v-if="index != 0" class="separator mb-4" />
        <div class="mt-4 row">
          <div class="col-5">
            <p class="text-small text-semi-bold">Public Key</p>
          </div>
          <div class="col-7">
            <p
              class="text-secondary text-small overflow-hidden"
              :data-testid="'p-contact-public-key-' + index"
            >
              {{ PublicKey.fromString(key.publicKey).toStringRaw() }}
            </p>
            <p
              class="text-small text-semi-bold text-pink mt-3"
              :data-testid="'p-contact-public_type_key-' + index"
            >
              {{ PublicKey.fromString(key.publicKey)._key._type }}
            </p>
          </div>
        </div>

        <ContactDetailsAssociatedAccounts
          :publicKey="key.publicKey"
          :accounts="publicKeyToAccounts[key.publicKey]"
          :linkedAccounts="linkedAccounts"
          :index="index"
          @update:linkedAccounts="emit('update:linkedAccounts', $event)"
          class="mt-4"
        />

        <ContactDetailsLinkedAccounts
          :publicKey="key.publicKey"
          :accounts="publicKeyToAccounts[key.publicKey]"
          :allLinkedAccounts="linkedAccounts"
          :index="index"
          class="mt-4"
        />
      </div>
    </template>
  </div>
</template>
