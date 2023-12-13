<script setup lang="ts">
import { ref } from 'vue';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { validateMnemonic } from '../../../services/keyPairService';

import AppTabs, { TabItem } from '../../../components/ui/AppTabs.vue';

import Generate from './Generate.vue';
import Import from './Import.vue';

const props = defineProps<{
  handleContinue: () => void;
}>();

const keyPairsStore = useKeyPairsStore();

const tabItems: TabItem[] = [{ title: 'Create New' }, { title: 'Import Existing' }];

const activeTabIndex = ref(0);

const handleSaveWords = async (words: string[]) => {
  const isValid = await validateMnemonic(words);

  if (!isValid) {
    console.log('Invalid Recovery Phrase!');
  } else {
    keyPairsStore.setRecoveryPhrase(words);
    props.handleContinue();
  }
};
</script>
<template>
  <div class="d-flex flex-column justify-content-center align-items-center">
    <div class="col-12 col-lg-10 col-xxl-8">
      <AppTabs
        :items="tabItems"
        v-model:activeIndex="activeTabIndex"
        class="mt-8 w-100"
        nav-item-class="col-6"
        nav-item-button-class="justify-content-center"
      ></AppTabs>
      <template v-if="activeTabIndex === 0">
        <Generate :handle-continue="handleSaveWords" />
      </template>
      <template v-else-if="activeTabIndex === 1">
        <Import :handle-continue="handleSaveWords"
      /></template>
    </div>
  </div>
</template>
