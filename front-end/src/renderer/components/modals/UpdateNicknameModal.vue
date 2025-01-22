<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { updateNickname } from '@renderer/services/keyPairService';

import { getNicknameById } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Store */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Props */
const props = defineProps<{
  show: boolean;
  keyPairId: string;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* State */
const nickname = ref('');
const isUpdating = ref(false);

/* Handlers */
const handleShow = (show: boolean) => emit('update:show', show);

const handleUpdate = async () => {
  const oldNickname = getNicknameById(props.keyPairId, user.keyPairs);

  if (nickname.value.trim() === (oldNickname || '')) {
    toast.error('New nickname cannot be the same as the current one');
    return;
  }

  let success = false;

  try {
    isUpdating.value = true;

    await updateNickname(props.keyPairId, nickname.value.trim());
    success = true;
    await user.refetchKeys();
  } finally {
    isUpdating.value = false;
  }

  if (success) {
    handleShow(false);
    toast.success('Nickname updated successfully');
  }
};

/* Functions */
const syncNickname = (show: boolean) => {
  if (show) {
    nickname.value = getNicknameById(props.keyPairId, user.keyPairs) || '';
  } else {
    nickname.value = '';
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
        <h3 class="text-center text-title text-bold mt-5">Update key pair nickname</h3>
        <div class="form-group mt-4">
          <label class="form-label">Enter Nickname</label>
          <AppInput
            data-testid="input-key-pair-nickname"
            v-model="nickname"
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
            :disabled="isUpdating"
            :loading="isUpdating"
            loading-text="Updating..."
            data-testid="button-confirm-update-nickname"
            >Update</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
