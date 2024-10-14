<script setup lang="ts">
import { computed, ref } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import { isPublicKey, isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  alreadyAdded?: string[];
  multiple?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'selected:single', publicKey: PublicKey): void;
  (event: 'selected:multiple', publicKeys: PublicKey[]): void;
}>();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* State */
const publicKey = ref('');
const selectedPublicKeys = ref<string[]>([]);
const currentTab = ref('my');

/* Computed */
const keyList = computed(() => {
  const keys = user.keyPairs
    .map(kp => ({ publicKey: kp.public_key, nickname: kp.nickname }))
    .concat(isLoggedInOrganization(user.selectedOrganization) ? contacts.publicKeys : []);

  return keys.filter(k => keys.findIndex(k2 => k2.publicKey === k.publicKey) === keys.indexOf(k));
});
const listedKeyList = computed(() => {
  if (props.alreadyAdded && props.alreadyAdded.length > 0) {
    return keyList.value.filter(k => !props.alreadyAdded?.includes(k.publicKey));
  } else {
    return keyList.value;
  }
});

/* Handlers */
const handleInsert = (e: Event) => {
  e.preventDefault();

  if (props.multiple && selectedPublicKeys.value.length === 0 && publicKey.value.trim() === '')
    return;

  if (!props.multiple && !isPublicKey(publicKey.value.trim())) {
    throw new Error('Invalid public key');
  }

  try {
    const manualKey = publicKey.value.trim()
      ? PublicKey.fromString(publicKey.value.trim())
      : undefined;

    if (!props.multiple) {
      if (!manualKey) {
        throw new Error('Invalid public key');
      }
      emit('selected:single', manualKey);
    } else {
      const publicKeys = selectedPublicKeys.value.map(pk => PublicKey.fromString(pk));
      manualKey && publicKeys.push(manualKey);

      emit('selected:multiple', publicKeys);
    }

    publicKey.value = '';
    selectedPublicKeys.value = [];
    emit('update:show', false);
  } catch (error) {
    throw new Error('Invalid public key/s');
  }
};

/* Handlers */
const handleKeyTabChange = async (tab: string) => {
  currentTab.value = tab;
};
</script>
<template>
  <AppModal :show="show" @update:show="$emit('update:show', $event)" class="large-modal">
    <div class="p-4">
      <form @submit="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Add Public Key</h1>

        <p class="text-micro text-bold mt-5">Search by or paste public key</p>
        <div class="mt-3">
          <AppInput
            v-model:model-value="publicKey"
            data-testid="input-complex-public-key"
            filled
            type="text"
            placeholder="Public Key"
          />
        </div>

        <hr class="separator my-5" />

        <div class="btn-group d-flex justify-content-between">
          <AppButton
            @click="handleKeyTabChange('my')"
            :class="{ active: currentTab === 'my' }"
            color="secondary"
            data-testid="tab-keys-my"
            >My keys</AppButton
          >
          <AppButton
            @click="handleKeyTabChange('accounts')"
            :class="{ active: currentTab === 'accounts' }"
            color="secondary"
            data-testid="tab-keys-accounts"
            >My Accounts</AppButton
          >
          <AppButton
            @click="handleKeyTabChange('contacts')"
            :class="{ active: currentTab === 'contacts' }"
            color="secondary"
            data-testid="tab-keys-contacts"
            >My Contacts</AppButton
          >
        </div>
        <div>
          <!-- <h3 class="text-small">Recent</h3> -->
          <template v-if="listedKeyList.length > 0">
            <div class="mt-4 overflow-auto" :style="{ height: '313px' }">
              <template v-for="kp in listedKeyList" :key="kp.public_key">
                <AppListItem
                  class="mt-3"
                  :selected="
                    multiple
                      ? selectedPublicKeys.includes(kp.publicKey)
                      : publicKey === kp.publicKey
                  "
                  :value="kp.publicKey"
                  @click="
                    multiple
                      ? (selectedPublicKeys = selectedPublicKeys.includes(kp.publicKey)
                          ? selectedPublicKeys.filter(id => id !== kp.publicKey)
                          : [...selectedPublicKeys, kp.publicKey])
                      : (publicKey = kp.publicKey)
                  "
                >
                  <div class="d-flex overflow-hidden">
                    <p class="text-nowrap">
                      <span class="bi bi-key m-2"></span>
                      <span class="ms-2 text-nowrap">{{
                        kp.nickname ||
                        contacts.getContactByPublicKey(kp.publicKey)?.nickname.trim() ||
                        contacts.getContactByPublicKey(kp.publicKey)?.user.email ||
                        'Public Key'
                      }}</span>
                    </p>
                    <div class="border-start px-4 mx-4">
                      <span>{{ kp.publicKey }}</span>
                    </div>
                  </div>
                </AppListItem>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="flex-centered flex-column mt-4" :style="{ height: '158px' }">
              <p class="text-muted">There are no selectable public keys</p>
            </div>
          </template>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="secondary" type="button" @click="$emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-insert-public-key"
            type="submit"
            :disabled="!isPublicKey(publicKey) && selectedPublicKeys.length === 0"
            >Insert</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
