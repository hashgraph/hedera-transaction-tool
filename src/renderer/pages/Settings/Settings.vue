<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useOrganizationsStore from '../../stores/storeOrganizations';
import useKeyPairsStore from '../../stores/storeKeyPairs';
import useUserStateStore from '../../stores/storeUserState';

import { useToast } from 'vue-toast-notification';
import { useRouter, RouterView } from 'vue-router';

import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';

/* Stores */
const organizationsStore = useOrganizationsStore();
const userStateStore = useUserStateStore();

/* Composables */
const router = useRouter();
const toast = useToast();

/* Misc */
const tabItems: TabItem[] = [
  { title: 'General' },
  { title: 'Work Groups' },
  { title: 'Keys' },
  { title: 'Account' },
];
const tabTitles = tabItems.map(t => t.title.toLocaleLowerCase().replaceAll(' ', '-'));

const propTabIndex = tabTitles.findIndex(
  t =>
    router.currentRoute.value.path
      .split('/')
      .filter(p => p)
      .reverse()[0]
      .toLocaleLowerCase() === t,
);

/* State */
const activeTabIndex = ref(propTabIndex >= 0 ? propTabIndex : 0);

/* Getters */
const activeTabTitle = computed(() => tabItems[activeTabIndex.value].title);

/* Handlers */
const handleClearConfig = async () => {
  try {
    await window.electronAPI.config.clear();
    if (userStateStore.userData?.userId) {
      await window.electronAPI.keyPairs.clear(userStateStore.userData?.userId);
    }

    organizationsStore.refetch();
    const keyPairsStore = useKeyPairsStore();

    keyPairsStore.refetch();
  } catch (err: any) {
    let message = 'Failed to clear config';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  }
};

/* Watchers */
watch(activeTabIndex, newIndex => {
  router.push(tabTitles[newIndex]);
});

watch(router.currentRoute, newRoute => {
  const title = newRoute.path
    .split('/')
    .filter(p => p)
    .reverse()[0];

  if (!newRoute.name?.toString().includes('settings')) {
    return;
  }

  if (title) {
    const routeTabIndex = tabTitles.findIndex(t => title.toLocaleLowerCase() === t);
    routeTabIndex != activeTabIndex.value ? (activeTabIndex.value = routeTabIndex) : {};
  }
});
</script>
<template>
  <div class="p-10">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="text-huge text-bold">Settings</h1>
      <AppButton size="small" color="secondary" @click="handleClearConfig">Clear Config</AppButton>
    </div>
    <div class="mt-7">
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[activeTabTitle]>
          <RouterView />
        </template>
      </AppTabs>
    </div>
  </div>
</template>
