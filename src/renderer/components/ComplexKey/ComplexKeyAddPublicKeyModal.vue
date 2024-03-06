<script setup lang="ts">
import { ref } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPublicKeyInput from '@renderer/components/ui/AppPublicKeyInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  onPublicKeyAdd: (publicKey: PublicKey) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const keyPairs = useKeyPairsStore();

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
            filled
            type="text"
            placeholder="Enter Public Key"
          />
        </div>
        <hr class="separator my-5" />
        <div>
          <h3 class="text-small">Recent</h3>
          <div class="mt-4 overflow-auto" :style="{ height: '150px', paddingRight: '10px' }">
            <template v-for="kp in keyPairs.keyPairs" :key="kp.public_key">
              <div class="mt-3" @click="publicKey = kp.public_key">
                <AppPublicKeyInput
                  :model-value="kp.public_key"
                  :label="kp.nickname || 'Public Key'"
                  filled
                  class="cursor-pointer"
                  readonly
                />
              </div>
            </template>
          </div>
        </div>
        <hr class="separator my-5" />
        <div class="row justify-content-between">
          <div class="col-4 d-grid">
            <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
              >Cancel</AppButton
            >
          </div>
          <div class="col-4 d-grid">
            <AppButton color="primary" type="submit" :disabled="!isPublicKey(publicKey)"
              >Insert</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
