<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import Generate from './Generate.vue';
import Import from './Import.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
defineProps<{
  handleNext: () => void;
}>();

/* Stores */
const importRef = ref<InstanceType<typeof Import> | null>(null);
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* State */
const tabItems = ref<TabItem[]>([{ title: 'Create New' }, { title: 'Import Existing' }]);
const activeTabIndex = ref(1);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

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
      <Generate :handle-next="handleNext" />
    </template>
    <template v-else-if="activeTabTitle === 'Import Existing'">
      <Import ref="importRef" :secret-hashes="user.data.secretHashes" />
      <div class="flex-between-centered mt-6">
        <AppButton color="borderless" @click="importRef?.clearWords()">Clear</AppButton>
        <AppButton
          v-if="keyPairsStore.recoveryPhraseWords.length > 0"
          color="primary"
          @click="handleNext"
          >Next</AppButton
        >
      </div>
    </template>
  </div>
</template>
