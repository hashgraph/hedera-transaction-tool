<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, RouterView } from 'vue-router';

import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';

import useOrganizationsStore from '../../stores/storeOrganizations';
import useKeyPairsStore from '../../stores/storeKeyPairs';
import useUserStateStore from '../../stores/storeUserState';

/* Route */
const router = useRouter();

/* Tabs */
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

const activeTabIndex = ref(propTabIndex >= 0 ? propTabIndex : 0);
const activeTabTitle = computed(() => tabItems[activeTabIndex.value].title);

/* Stores */
const organizationsStore = useOrganizationsStore();
const userStateStore = useUserStateStore();

const handleClearConfig = async () => {
  await window.electronAPI.config.clear();
  if (userStateStore.userData?.userId) {
    await window.electronAPI.keyPairs.clear(userStateStore.userData?.userId);
  }

  organizationsStore.refetch();
  const keyPairsStore = useKeyPairsStore();

  keyPairsStore.refetch();
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

  if (title) {
    const routeTabIndex = tabTitles.findIndex(t => title.toLocaleLowerCase() === t);
    routeTabIndex != activeTabIndex.value ? (activeTabIndex.value = routeTabIndex) : {};
  }

  //   const routeTabIndex = tabTitles.findIndex(
  //   t =>
  //     [0]
  //       .toLocaleLowerCase() === t,
  // );
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
