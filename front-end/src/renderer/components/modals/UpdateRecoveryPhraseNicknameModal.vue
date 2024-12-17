<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';

import { assertUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{ show: boolean; recoveryPhraseHash: string }>();

/* Emits */
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'updated'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const recoveryPhraseNickname = useRecoveryPhraseNickname();

/* State */
const nickname = ref('');
const loadingText = ref<string | null>(null);

/* Handlers */
const handleUpdate = async () => {
  assertUserLoggedIn(user.personal);

  try {
    loadingText.value = 'Updating...';

    await recoveryPhraseNickname.set(props.recoveryPhraseHash, nickname.value);

    toast.success('Nickname updated successfully');

    emit('update:show', false);
    emit('updated');
  } finally {
    loadingText.value = null;
  }
};

/* Functions */
const syncNickname = (show: boolean) => {
  if (show) {
    const mnemonic = user.mnemonics.find(m => m.mnemonicHash === props.recoveryPhraseHash);
    nickname.value = mnemonic?.nickname || '';
  } else {
    nickname.value = '';
  }
};

/* Watchers */
watch(
  () => props.show,
  show => syncNickname(show),
);
</script>
<template>
  <AppModal
    v-if="show"
    :show="show"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center mt-5">
        <i class="bi bi-pencil-fill large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit.prevent="handleUpdate">
        <h3 class="text-center text-title text-bold mt-3">Update Recovery Phrase Nickname</h3>
        <div class="form-group mt-4">
          <label class="form-label">Enter Nickname</label>
          <AppInput
            data-testid="input-recovery-phrase-nickname"
            v-model="nickname"
            :filled="true"
            size="small"
            name="recovery-phrase-nickname"
            placeholder="Enter Nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            type="button"
            color="borderless"
            data-testid="button-cancel-update-nickname"
            @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton
            type="submit"
            color="primary"
            :loading="Boolean(loadingText)"
            :loading-text="loadingText || ''"
            data-testid="button-confirm-update-recovery-phrase-nickname"
            >Update</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
