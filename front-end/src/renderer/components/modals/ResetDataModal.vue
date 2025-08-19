<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { resetDataLocal } from '@renderer/services/userService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
defineProps<{ show: boolean }>();

/* Emits */
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'data:reset'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Handlers */
const handleResetData = async () => {
  await resetDataLocal();
  user.logout();

  toast.success('User data has been reset');

  emit('update:show', false);
  emit('data:reset');
};
</script>
<template>
  <AppModal
    v-if="show"
    :show="show"
    @update:show="emit('update:show', $event)"
    class="common-modal"
  >
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="emit('update:show', false)"></i>
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold">Reset Data</h3>
      <p class="text-center text-small text-secondary mt-4">
        Resetting the application will remove all personal data, including keys and organization
        credentials.
      </p>
      <p class="text-center text-small text-secondary mt-2">
        You will need to import all of your keys and reconnect to each organization.
      </p>
      <p class="text-center text-small text-secondary mt-4">
        Are you sure you want to reset the app data?
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          type="button"
          color="borderless"
          @click="emit('update:show', false)"
          data-testid="button-reset-cancel"
          >Cancel</AppButton
        >
        <AppButton type="button" color="danger" @click="handleResetData" data-testid="button-reset"
          >Reset</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
