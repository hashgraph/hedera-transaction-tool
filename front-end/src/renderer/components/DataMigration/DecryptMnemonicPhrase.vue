<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

/* Props */
defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'passwordEntered', password: string): void;
}>();

/* State */
const password = ref<string>('');
const error = ref<string | null>(null);

/* Handlers */
const handleSubmit = () => {
  if (password.value.trim().length === 0) {
    error.value = 'Password cannot be empty';
    return;
  }
  emit('passwordEntered', password.value);
};

const handleClose = () => {
  password.value = '';
  error.value = null;
  emit('update:show', false);
};
</script>

<template>
  <AppModal
    :show="show"
    @update:show="handleClose"
    class="medium-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose"></i>
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit.prevent="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Enter Password</h3>

        <div class="form-group mt-4">
          <label class="form-label">Password</label>
          <AppPasswordInput
            v-model="password"
            size="small"
            name="password"
            :filled="true"
            placeholder="Type the password to decrypt the mnemonic phrase"
            data-testid="input-mnemonic-decryption-password"
          />
        </div>

        <div v-if="error" class="text-danger mt-2">
          {{ error }}
        </div>

        <div class="flex-between-centered gap-4 mt-4">
          <AppButton color="secondary" type="button" class="min-w-unset" @click="handleClose"
            >Cancel</AppButton
          >
          <AppButton color="primary" type="submit" class="min-w-unset">Submit</AppButton>
        </div>
      </form>
    </div>
  </AppModal>
</template>
