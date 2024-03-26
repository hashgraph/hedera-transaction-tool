<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useRouter, RouterView } from 'vue-router';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import ImportExternalPrivateKeyDropDown from '@renderer/components/ImportExternalPrivateKeyDropDown.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Composables */
const router = useRouter();

/* Misc */
const generalTitle = 'General';
const keysTitle = 'Keys';
const organizations = 'Organization Connections';
const profileTitle = 'Profile';
const tabItems: TabItem[] = [
  { title: generalTitle },
  // { title: 'Work Groups' },
  { title: organizations },
  { title: keysTitle },
  { title: profileTitle },
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
    <div class="flex-column-100 overflow-hidden">
      <div class="d-flex justify-content-between align-items-start">
        <h1 class="text-title text-bold">Settings</h1>
        <div
          v-if="activeTabIndex === tabItems.findIndex(t => t.title === keysTitle)"
          class="d-flex gap-3"
        >
          <AppButton color="borderless" @click="$router.push({ name: 'restoreKey' })">
            Restore
          </AppButton>
          <ImportExternalPrivateKeyDropDown class="min-w-unset" />
        </div>
      </div>
      <div class="overflow-hidden mt-7">
        <AppTabs
          :items="tabItems"
          v-model:active-index="activeTabIndex"
          :content-container-class="'fill-remaining'"
          class="flex-column-100"
        >
          <template #[activeTabTitle]>
            <RouterView />
          </template>
        </AppTabs>
      </div>
    </div>
  </div>
</template>
