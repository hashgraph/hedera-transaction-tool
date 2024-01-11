<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useKeyPairsStore from '../../../stores/storeKeyPairs';
import useUserStateStore from '../../../stores/storeUserState';

import { validateMnemonic, hashRecoveryPhrase } from '../../../services/keyPairService';

import AppTabs, { TabItem } from '../../../components/ui/AppTabs.vue';
import Generate from './Generate.vue';
import Import from './Import.vue';

/* Props */
const props = defineProps<{
  handleContinue: () => void;
}>();

/* Stores */
const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();

/* State */
const tabItems = ref<TabItem[]>([{ title: 'Create New' }, { title: 'Import Existing' }]);
const activeTabIndex = ref(0);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Handlers */
const handleSaveWords = async (words: string[]) => {
  const isValid = await validateMnemonic(words);

  if (!isValid) {
    console.log('Invalid Recovery Phrase!');
  } else {
    keyPairsStore.setRecoveryPhrase(words);
    userStateStore.setSecretHashes([
      ...(userStateStore.secretHashes || []),
      await hashRecoveryPhrase(words),
    ]);
    // SEND SECRET HASH TO BACKED?

    props.handleContinue();
  }
};

/* Hooks */
onBeforeMount(() => {
  userStateStore.secretHashes.length > 0 && tabItems.value.shift();
});
</script>
<template>
  <div class="d-flex flex-column justify-content-center align-items-center">
    <div class="col-12 col-lg-10 col-xxl-8">
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
        <Import :handle-continue="handleSaveWords" :secret-hashes="userStateStore.secretHashes"
      /></template>
    </div>
  </div>
</template>
