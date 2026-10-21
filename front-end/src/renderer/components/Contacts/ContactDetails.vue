<script setup lang="ts">
import type { HederaAccount, PublicKeyMapping } from '@prisma/client';
import type { AccountInfo, Contact } from '@shared/interfaces';
import { ToastManager } from '@renderer/utils/ToastManager';

import { computed, onBeforeMount, ref, watch } from 'vue';

import { PublicKey } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import { addContact, updateContact } from '@renderer/services/contactsService';
import { signUp } from '@renderer/services/organization';

import {
  extractIdentifier,
  getAllPublicKeyMappings,
  getErrorMessage,
  getPublicKeyMapping,
  isLoggedInOrganization,
  isUserLoggedIn,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import ContactDetailsAssociatedAccounts from '@renderer/components/Contacts/ContactDetailsAssociatedAccounts.vue';
import ContactDetailsLinkedAccounts from '@renderer/components/Contacts/ContactDetailsLinkedAccounts.vue';
import RenamePublicKeyModal from '@renderer/pages/Settings/components/PublicKeysTab/components/RenamePublicKeyModal.vue';
import { AppCache } from '@renderer/caches/AppCache';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';
import { formatDatePart, formatDateTime } from '@renderer/utils/dateTimeFormat.ts';
import { getLatestClient } from '@renderer/utils/clientVersion.ts';

/* Modals */
const linkedAccounts = defineModel<HederaAccount[]>('linkedAccounts', {required: true});

/* Props */
const props = defineProps<{
  contact: Contact;
}>();

/* Composables */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const contacts = useContactsStore();

/* Injected */
const accountByPublicKeyCache = AppCache.inject().mirrorAccountByPublicKey;

/* State */
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const publicKeyToAccounts = ref<{ [key: string]: AccountInfo[] }>({});
const publicKeysMapping = ref<Record<string, string>>({});
const isUpdateNicknameModalShown = ref(false);
const publicKeyMappingToEdit = ref<PublicKeyMapping | null>(null);
const publicKeyToEdit = ref<string | null>(null);

/* Computed */
const { isUtcSelected } = useDateTimeSetting();

const latestClient = computed(() => getLatestClient(props.contact.user.clients));

const latestClientDate = computed(() => {
  if (!latestClient.value) return null;
  return formatDatePart(new Date(latestClient.value.updatedAt), isUtcSelected.value, true);
});

const isApiKeyActive = computed(
  () => !!props.contact.user.apiKeyStatus?.hasKey && !props.contact.user.apiKeyStatus?.revokedAt,
);

const userKeysAndMappings = computed(() => {
  return props.contact.userKeys.map(uk => ({
    ...uk,
    publicKeyMapping: extractIdentifier(
      publicKeysMapping.value[PublicKey.fromString(uk.publicKey).toStringRaw()],
    ),
  }));
});

/* Helpers */
const formatApiKeyDateTime = (value: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return formatDateTime(date, isUtcSelected.value, true);
};

/* Emits */
defineEmits<{
  (event: 'remove'): void;
  (event: 'elevate-to-admin'): void;
  (event: 'toggle-view-reports'): void;
}>();

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

const handleStartKeyNicknameEdit = async (publicKey: string) => {
  publicKeyMappingToEdit.value = await getPublicKeyMapping(publicKey);
  publicKeyToEdit.value = publicKey;
  isUpdateNicknameModalShown.value = true;
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
  publicKeyToAccounts.value = await accountByPublicKeyCache.batchLookup(
    props.contact.userKeys.map(key => key.publicKey),
    network.mirrorNodeBaseURL,
  );
};

const handleResend = async () => {
  try {
    if (user.selectedOrganization?.serverUrl) {
      const email = props.contact.user.email;
      await signUp(user.selectedOrganization.serverUrl, email);
    }
    toastManager.success('Email sent successfully');
  } catch (error) {
    toastManager.error(
      getErrorMessage(error, 'Error while sending email. Please try again.'),
    );
  }
};

const handleContactChange = async () => {
  await Promise.allSettled([
    contacts.fetchUserKeys(props.contact.user.id),
    handleAccountsLookup(),
    handleFetchMapping(),
  ]);
};

const handleFetchMapping = async () => {
  const contactPublicKeys = props.contact.userKeys.map(key => key.publicKey);
  if (contactPublicKeys.length === 0) return;

  const allMappings = await getAllPublicKeyMappings();
  // Canonicalize stored keys to raw so DER-imported mappings are still found
  const mappingByKey = new Map(
    allMappings.map(m => [PublicKey.fromString(m.public_key).toStringRaw(), m]),
  );

  publicKeysMapping.value = Object.fromEntries(
    contactPublicKeys.map(key => {
      const rawKey = PublicKey.fromString(key).toStringRaw();
      const mapping = mappingByKey.get(rawKey);
      // Key by raw form to match the template's toStringRaw() lookup
      return [rawKey, mapping ? `${mapping.nickname} (${mapping.public_key})` : key];
    }),
  );
};

/* Hooks */
onBeforeMount(handleContactChange);
/* Watchers */
watch(() => props.contact, handleContactChange);
watch(() => props.contact.userKeys, async () => {
  await Promise.all([handleAccountsLookup(), handleFetchMapping()]);
});
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
      <template v-if="contact.user.status === 'NEW'">
        <AppButton
          data-testid="button-resend-email-from-contact-list"
          class="min-w-unset"
          color="secondary"
          @click="handleResend"
          >Resend email</AppButton
        >
      </template>
      <template v-if="!contact.user.admin">
        <AppButton
          data-testid="button-elevate-to-admin-from-contact-list"
          class="min-w-unset"
          color="secondary"
          @click="$emit('elevate-to-admin')"
          >Assign Admin</AppButton
        >
      </template>
      <AppButton
        data-testid="button-remove-account-from-contact-list"
        class="min-w-unset"
        color="danger"
        @click="$emit('remove')"
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
  <div
    v-if="isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin"
    class="mt-4 row"
  >
    <div class="col-5">
      <p class="text-main text-semi-bold">App</p>
    </div>
    <div class="col-7">
      <p class="text-secondary overflow-hidden" data-testid="p-contact-cli-version">
        <template v-if="latestClient">
          <small>version {{ latestClient.version }} | updated on: {{ latestClientDate }}</small>
        </template>
        <template v-else> - </template>
      </p>
    </div>
  </div>
  <hr
    v-if="
      isLoggedInOrganization(user.selectedOrganization) &&
      user.selectedOrganization.admin &&
      contact.user.id !== user.selectedOrganization.userId
    "
    class="separator my-4"
  />
  <div
    v-if="
      isLoggedInOrganization(user.selectedOrganization) &&
      user.selectedOrganization.admin &&
      contact.user.id !== user.selectedOrganization.userId
    "
  >
    <div class="d-flex align-items-center justify-content-between">
      <p class="text-main text-semi-bold mb-0">Report API access</p>
      <AppSwitch
        v-if="!contact.user.admin"
        :key="contact.user.id"
        name="report-api-access"
        :checked="contact.user.canViewReports"
        aria-label="Report API access"
        data-testid="switch-report-api-access"
        @update:checked="$emit('toggle-view-reports')"
      />
    </div>
    <div v-if="contact.user.admin || contact.user.canViewReports" class="ps-3 mt-2">
      <template v-if="isApiKeyActive">
        <div class="row">
          <div class="col-5">
            <p class="text-small text-semi-bold mb-0">Created</p>
          </div>
          <div class="col-7">
            <p class="text-small text-secondary mb-0" data-testid="p-contact-api-key-created-at">
              {{ formatApiKeyDateTime(contact.user.apiKeyStatus?.createdAt ?? null) }}
            </p>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col-5">
            <p class="text-small text-semi-bold mb-0">Last used</p>
          </div>
          <div class="col-7">
            <p class="text-small text-secondary mb-0" data-testid="p-contact-api-key-last-used-at">
              {{ formatApiKeyDateTime(contact.user.apiKeyStatus?.lastUsedAt ?? null) }}
            </p>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col-5">
            <p class="text-small text-semi-bold mb-0">Key Reference</p>
          </div>
          <div class="col-7">
            <p class="text-small text-secondary mb-0" data-testid="p-contact-api-key-id">
              {{ contact.user.apiKeyStatus?.keyId }}
            </p>
          </div>
        </div>
      </template>
      <template v-else-if="contact.user.apiKeyStatus?.hasKey">
        <p class="text-small text-secondary" data-testid="p-contact-api-key-revoked">
          No active key (revoked
          {{ formatApiKeyDateTime(contact.user.apiKeyStatus.revokedAt) }})
        </p>
      </template>
      <template v-else-if="contact.user.apiKeyStatus">
        <p class="text-small text-secondary" data-testid="p-contact-no-api-key">
          No key created
        </p>
      </template>
      <template v-else>
        <p class="text-small text-secondary" data-testid="p-contact-api-key-unavailable">
          Key status unavailable
        </p>
      </template>
    </div>
  </div>
  <hr class="separator my-4" />
  <div class="fill-remaining overflow-x-hidden pe-3">
    <template v-for="(key, index) in userKeysAndMappings" :key="key.publicKey">
      <div class="p-4">
        <hr v-if="index != 0" class="separator mb-4" />
        <div class="mt-4 row">
          <div class="col-5">
            <p class="text-small text-semi-bold">
              <span
                class="bi bi-pencil-square text-main text-primary me-3 cursor-pointer"
                data-testid="button-change-key-nickname"
                @click="handleStartKeyNicknameEdit(key.publicKey)"
              ></span>
              <template v-if="key.publicKeyMapping">
                <span>
                  {{ key.publicKeyMapping.identifier }}
                </span>
              </template>
              <template v-else> Public Key </template>
            </p>
          </div>
          <div class="col-7">
            <p class="overflow-x-auto" :data-testid="'p-contact-public-key-' + index">
              <span class="text-secondary text-small">
                {{ key.publicKey }}
              </span>
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
          v-model:linked-accounts="linkedAccounts"
          :publicKey="key.publicKey"
          :accounts="publicKeyToAccounts[key.publicKey]"
          :index="index"
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
    <RenamePublicKeyModal
      v-model:show="isUpdateNicknameModalShown"
      :public-key-mapping="publicKeyMappingToEdit"
      :public-key="publicKeyToEdit"
      @change="handleFetchMapping"
    />
  </div>
</template>
