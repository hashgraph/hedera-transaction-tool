<script setup lang="ts">
import { ref } from 'vue';

import useMirrorNodeLinksStore from '../../stores/storeMirrorNodeLinks';

import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';
import GeneralTab from './components/GeneralTab.vue';
import WorkGroupsTab from './components/WorkGroupsTab.vue';
import KeysTab from './components/KeysTab.vue';
import useOrganizationsStore from '../../stores/storeOrganizations';

/* Props */
const props = defineProps<{ tab: string }>();

/* Tabs */
const tabItems: TabItem[] = [{ title: 'General' }, { title: 'Work Groups' }, { title: 'Keys' }];
const propTabIndex = tabItems.findIndex(
  t => t.title.toLocaleLowerCase().replaceAll(' ', '-') === props.tab,
);
const activeTabIndex = ref(propTabIndex >= 0 ? propTabIndex : 0);
const [general, workGroups, keys] = tabItems.map(t => t.title);

/* Stores */
const mirrorNodeLinks = useMirrorNodeLinksStore();
const organizationsStore = useOrganizationsStore();

const handleClearConfig = async () => {
  await window.electronAPI.config.clear();

  mirrorNodeLinks.refetch();
  organizationsStore.refetch();
};
</script>
<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Settings</h1>
    <AppButton color="secondary" @click="handleClearConfig">Clear Config</AppButton>
    <div class="mt-7">
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[general]>
          <GeneralTab />
        </template>
        <template #[workGroups]>
          <WorkGroupsTab />
        </template>
        <template #[keys]>
          <KeysTab />
        </template>
      </AppTabs>
    </div>
  </div>
</template>
