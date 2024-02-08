<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useRouter, RouterView } from 'vue-router';

import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';

/* Composables */
const router = useRouter();

/* Misc */
const tabItems: TabItem[] = [
  { title: 'General' },
  // { title: 'Work Groups' },
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
  <div class="p-5">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="text-title text-bold">Settings</h1>
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
