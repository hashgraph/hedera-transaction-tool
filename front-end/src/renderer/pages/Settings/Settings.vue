<script setup lang="ts">
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';

import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter, RouterView } from 'vue-router';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { isLoggedInOrganization } from '@renderer/utils';

import AppTabs from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import ImportDropDown from './components/ImportDropDown.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});

/* Misc */
const generalTitle = 'General';
const keysTitle = 'Keys';
const organizationsTitle = 'Organizations';
const profileTitle = 'Profile';
const notificationsTitle = 'Notifications';

const tabItems: TabItem[] = [
  { title: generalTitle },
  { title: organizationsTitle },
  { title: keysTitle },
  { title: profileTitle },
  { title: notificationsTitle },
];
const tabTitles = tabItems.map(t => t.title.toLocaleLowerCase().split(' ').join('-'));

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

/* Computed */
const visibleTabItems = computed(() =>
  tabItems.filter(t => {
    if (t.title === notificationsTitle) {
      return isLoggedInOrganization(user.selectedOrganization);
    }

    return true;
  }),
);
const activeTabTitle = computed(() => tabItems[activeTabIndex.value].title);

/* Watchers */
watch(activeTabIndex, newIndex => {
  router.push(tabTitles[newIndex]);
});

watch(
  () => user.selectedOrganization,
  () => {
    if (
      activeTabTitle.value === notificationsTitle &&
      !isLoggedInOrganization(user.selectedOrganization)
    ) {
      activeTabIndex.value = tabItems.findIndex(t => t.title === generalTitle);
    }
  },
);

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
          <AppButton
            data-testid="button-restore"
            color="secondary"
            @click="$router.push({ name: 'restoreKey' })"
          >
            Generate
          </AppButton>
          <ImportDropDown />
        </div>
      </div>
      <div class="overflow-hidden mt-7">
        <AppTabs
          :items="visibleTabItems"
          v-model:active-index="activeTabIndex"
          :content-container-class="'fill-remaining pe-4'"
          class="flex-column-100"
        >
          <template #[activeTabTitle]>
            <div class="mt-6">
              <RouterView />
            </div>
          </template>
        </AppTabs>
      </div>
    </div>
  </div>
</template>
