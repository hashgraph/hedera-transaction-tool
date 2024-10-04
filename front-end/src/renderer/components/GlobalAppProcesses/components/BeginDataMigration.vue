<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { getUsersCount } from '@renderer/services/userService';
import { locateDataMigrationFiles } from '@renderer/services/migrateDataService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();

/* State */
const show = ref(false);

/* Emits */
const emit = defineEmits<{
  (event: 'ready'): void;
  (event: 'startMigrate'): void;
}>();

/* Handlers */
const handleChoose = (migrate: boolean) => {
  if (migrate) {
    emit('startMigrate');
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

/* Hooks */
onMounted(async () => {
  show.value = await checkShouldChoose();
});

/* Watchers */
watch(
  () => user.personal,
  async () => {
    const noUser = !user.personal || !user.personal.isLoggedIn;
    const shouldChoose = await checkShouldChoose();

    if (noUser && shouldChoose) show.value = true;
  },
);
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
        <AppButton color="borderless" @click="handleChoose(false)">No</AppButton>
        <AppButton color="primary" @click="handleChoose(true)">Yes</AppButton>
      </div>
    </div>
  </AppModal>
</template>
