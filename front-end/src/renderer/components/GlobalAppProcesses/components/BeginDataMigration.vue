<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useRouter } from 'vue-router';

import { getUsersCount } from '@renderer/services/userService';
import { locateDataMigrationFiles } from '@renderer/services/migrateDataService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Composables */
const router = useRouter();

/* State */
const show = ref(false);

/* Emits */
const emit = defineEmits<{
  (event: 'ready'): void;
  (event: 'ready:not'): void;
  (event: 'migrate:start'): void;
}>();

/* Handlers */
const handleChoose = (migrate: boolean) => {
  if (migrate) {
    emit('migrate:start');
    router.push({ name: 'migrate' });
  }

  emit('ready');
  show.value = false;
};

/* Functions */
const checkShouldChoose = async () => {
  try {
    const canMigrate = await locateDataMigrationFiles();
    const usersCount = await getUsersCount();

    return canMigrate && usersCount === 0;
  } catch {
    return false;
  }
};

const initialize = async () => {
  show.value = await checkShouldChoose();
  if (show.value) emit('ready:not');
  if (!show.value) emit('ready');
};

/* Hooks */
onMounted(initialize);

/* Expose */
defineExpose({ initialize });
</script>

<template>
  <AppModal
    :show="show"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleChoose(false)"></i>
      </div>
      <div class="text-center">
        <h3 class="text-title text-bold">Transaction Tools folder was found.</h3>
        <p class="text-small text-secondary mt-4">Do you want to migrate the data?</p>
      </div>
      <div class="flex-between-centered gap-4 mt-5">
        <AppButton
          color="borderless"
          @click="handleChoose(false)"
          data-testid="button-refuse-migration"
          >No</AppButton
        >
        <AppButton color="primary" @click="handleChoose(true)" data-testid="button-start-migration"
          >Yes</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
