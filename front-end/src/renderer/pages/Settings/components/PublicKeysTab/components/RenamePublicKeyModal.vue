<script setup lang="ts">
import { ref, watch } from 'vue';

import type { PublicKeyMapping } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { getErrorMessage } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
/* Store */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Props */
const props = defineProps<{
  show: boolean;
  publicKeyMapping: PublicKeyMapping | null;
  publicKey?: string | null;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'change']);

/* State */
const newNickname = ref('');
const isUpdating = ref(false);

/* Handlers */
const handleShow = (show: boolean) => emit('update:show', show);

const handleUpdate = async () => {
  try {
    isUpdating.value = true;
    if (props.publicKeyMapping) {
      await user.updatePublicKeyMappingNickname(
        props.publicKeyMapping.id,
        props.publicKeyMapping.public_key,
        newNickname.value,
      );
      toast.success('Nickname updated successfully', successToastOptions);
    } else if (props.publicKey) {
      await user.storePublicKeyMapping(props.publicKey, newNickname.value);
      toast.success('Nickname set successfully', successToastOptions);
    }
    emit('change');
    handleShow(false);
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to rename public key mapping'), errorToastOptions);
  } finally {
    isUpdating.value = false;
  }
};

/* Functions */
const syncNickname = (show: boolean) => {
  if (show && props.publicKeyMapping) {
    newNickname.value = props.publicKeyMapping.nickname;
  } else {
    newNickname.value = '';
  }
};

/* Watchers */
watch(
  () => props.show,
  show => {
    syncNickname(show);
  },
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleShow"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleShow(false)"></i>
      </div>
      <div class="text-center mt-5">
        <i class="bi bi-pencil-fill large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit.prevent="handleUpdate">
        <h3 class="text-center text-title text-bold mt-5">
          {{ publicKeyMapping ? 'Update' : 'Set' }} public key nickname
        </h3>
        <div class="form-group mt-4">
          <label class="form-label">Enter Nickname</label>
          <AppInput
            data-testid="input-public-key-nickname"
            v-model="newNickname"
            :filled="true"
            size="small"
            name="key-pair-nickname"
            placeholder="Type Nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            type="button"
            color="borderless"
            data-testid="button-cancel-update-nickname"
            @click="handleShow(false)"
            >Cancel</AppButton
          >
          <AppButton
            type="submit"
            color="primary"
            :disabled="isUpdating || !newNickname"
            :loading="isUpdating"
            loading-text="Updating..."
            data-testid="button-confirm-update-nickname"
            >{{ publicKeyMapping ? 'Update' : 'Set' }}</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
