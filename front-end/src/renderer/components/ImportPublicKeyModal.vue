<script setup lang="ts">
import { reactive, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { assertUserLoggedIn, getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const publicKeyMapping = reactive<{ publicKey: string; nickname: string }>({
  publicKey: '',
  nickname: '',
});

const handleImportPublicKey = async () => {
  try {
    await user.storePublicKeyMapping(publicKeyMapping.publicKey, publicKeyMapping.nickname);

    emit('update:show', false);

    toast.success(`Public key and nickname imported successfully`);
  } catch (error) {
    toast.error(getErrorMessage(error, `Failed to import public key key`));
  }
};

/* Watchers */
watch(
  () => props.show,
  () => {
    publicKeyMapping.publicKey = '';
    publicKeyMapping.nickname = '';
  },
);
</script>
<template>
  <AppModal
    v-if="show"
    :show="show"
    @update:show="$emit('update:show', $event)"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      <div class="text-center mt-5">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit.prevent="handleImportPublicKey">
        <div class="form-group mt-4">
          <label class="form-label">Enter Public key</label>
          <AppInput
            v-model="publicKeyMapping.publicKey"
            size="small"
            name="public-key"
            :filled="true"
            :placeholder="`Type Public key`"
            :data-testid="`input-public-key-mapping`"
          />
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Enter nickname</label>
          <AppInput
            v-model="publicKeyMapping.nickname"
            size="small"
            name="nickname"
            :filled="true"
            placeholder="Type Nickname"
            :data-testid="`input-public-key-nickname`"
          />
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            :disabled="!publicKeyMapping.nickname || !publicKeyMapping.publicKey"
            :data-testid="`button-public-key-import`"
            type="submit"
            color="primary"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
