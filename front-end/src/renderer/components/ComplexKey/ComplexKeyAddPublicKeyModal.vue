<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import { isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

/* Props */
const props = defineProps<{
  show: boolean;
  onPublicKeyAdd: (publicKey: PublicKey) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* State */
const publicKey = ref('');
const type = ref<'ED25519' | 'ECDSA'>('ED25519');

/* Computed */
const keyList = computed(() => {
  return user.keyPairs
    .map(kp => ({ publicKey: kp.public_key, nickname: kp.nickname }))
    .concat(isLoggedInOrganization(user.selectedOrganization) ? contacts.publicKeys : []);
});

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleInsert = (e: Event) => {
  e.preventDefault();

  if (!isPublicKey(publicKey.value.trim())) {
    throw new Error('Invalid public key');
  }

  const publicKeyInstance =
    type.value === 'ED25519'
      ? PublicKey.fromStringED25519(publicKey.value.trim())
      : PublicKey.fromStringECDSA(publicKey.value.trim());

  props.onPublicKeyAdd(publicKeyInstance);
  handleShowUpdate(false);
};

/* Watchers */
watch(
  () => props.show,
  show => {
    if (show) {
      publicKey.value = '';
      type.value = 'ED25519';
    }
  },
);
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Add Public Key</h1>

        <div class="mt-5">
          <AppInput
            v-model:model-value="publicKey"
            data-testid="input-complex-public-key"
            filled
            type="text"
            placeholder="Enter Public Key"
          />
        </div>
        <div class="text-center mt-3">
          <div class="btn-group d-flex">
            <AppButton
              size="small"
              color="secondary"
              type="button"
              data-testid="button-key-type-ed25519"
              :class="{ active: type === 'ED25519' }"
              @click="type = 'ED25519'"
              >ED25519</AppButton
            >
            <AppButton
              size="small"
              color="secondary"
              type="button"
              data-testid="button-key-type-ecdsa"
              :class="{ active: type === 'ECDSA' }"
              @click="type = 'ECDSA'"
              >ECDSA</AppButton
            >
          </div>
        </div>
        <hr class="separator my-5" />
        <div>
          <h3 class="text-small">Recent</h3>
          <div class="mt-4 overflow-auto" :style="{ height: '158px' }">
            <template v-for="kp in keyList" :key="kp.public_key">
              <AppListItem
                class="mt-3"
                :selected="publicKey === kp.publicKey"
                :value="kp.publicKey"
                @click="publicKey = kp.publicKey"
              >
                <div class="d-flex overflow-hidden">
                  <p class="text-nowrap">
                    <span class="bi bi-key m-2"></span>
                    <span class="ms-2 text-nowrap">{{ kp.nickname || 'Public Key' }}</span>
                  </p>
                  <div class="border-start px-4 mx-4">
                    <span>{{ kp.publicKey }}</span>
                  </div>
                </div>
              </AppListItem>
            </template>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-insert-public-key"
            type="submit"
            :disabled="!isPublicKey(publicKey)"
            >Insert</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
