<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { validateMnemonic } from '@renderer/services/keyPairService';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import Generate from './Generate.vue';
import Import from './Import.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* State */
const tabItems = ref<TabItem[]>([{ title: 'Create New' }, { title: 'Import Existing' }]);
const activeTabIndex = ref(1);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Handlers */
const handleSaveWords = async (words: string[]) => {
  const isValid = await validateMnemonic(words);

  if (!isValid) {
    throw new Error('Invalid Recovery Phrase!');
  } else {
    keyPairsStore.setRecoveryPhrase(words);
  }
};

/* Hooks */
onBeforeMount(() => {
  user.data.secretHashes.length > 0 && tabItems.value.shift();
  activeTabIndex.value = tabItems.value.findIndex(i => i.title === 'Import Existing');
});
</script>
<template>
  <div>
    <AppTabs
      :items="tabItems"
      v-model:activeIndex="activeTabIndex"
      class="mt-8 w-100"
      nav-item-class="flex-1"
      nav-item-button-class="justify-content-center"
    ></AppTabs>
    <template v-if="activeTabTitle === 'Create New'">
      <Generate :handle-continue="handleSaveWords" />
    </template>
    <template v-else-if="activeTabTitle === 'Import Existing'">
      <Import :handle-continue="handleSaveWords" :secret-hashes="user.data.secretHashes"
    /></template>
  </div>
</template>
