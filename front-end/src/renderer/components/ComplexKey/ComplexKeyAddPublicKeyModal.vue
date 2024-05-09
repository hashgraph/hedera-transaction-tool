<script setup lang="ts">
import { ref } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  onPublicKeyAdd: (publicKey: PublicKey) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* State */
const publicKey = ref('');

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleInsert = (e: Event) => {
  e.preventDefault();

  if (!isPublicKey(publicKey.value)) {
    throw new Error('Invalid public key');
  }

  props.onPublicKeyAdd(PublicKey.fromString(publicKey.value));
  handleShowUpdate(false);
};
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
        <hr class="separator my-5" />
        <div>
          <h3 class="text-small">Recent</h3>
          <div class="mt-4 overflow-auto" :style="{ height: '158px' }">
            <template v-for="kp in user.keyPairs" :key="kp.public_key">
              <AppListItem
                class="mt-3"
                :selected="publicKey === kp.public_key"
                :value="kp.public_key"
                @click="publicKey = kp.public_key"
              >
                <div class="d-flex overflow-hidden">
                  <p class="text-nowrap">
                    <span class="bi bi-key m-2"></span>
                    <span class="ms-2 text-nowrap">{{ kp.nickname || 'Public Key' }}</span>
                  </p>
                  <div class="border-start px-4 mx-4">
                    <span>{{ kp.public_key }}</span>
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
