<script setup lang="ts">
import {computed, onBeforeMount, ref} from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import type {TabItem} from '@renderer/components/ui/AppTabs.vue';
import AppTabs from '@renderer/components/ui/AppTabs.vue';
import Generate from './Generate.vue';
import Import from './Import.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
defineProps<{
  handleNext: () => void;
}>();

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* State */
const tabItems = ref<TabItem[]>([{title: 'Create New'}, {title: 'Import Existing'}]);
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
      v-model:activeIndex="activeTabIndex"
      :items="tabItems"
      class="mt-8 w-100"
      nav-item-class="flex-1"
      nav-item-button-class="justify-content-center"
    ></AppTabs>
    <template v-if="activeTabTitle === 'Create New'">
      <Generate :handle-next="handleNext" />
    </template>
    <template v-else-if="activeTabTitle === 'Import Existing'">
      <Import :secret-hashes="user.data.secretHashes" />
      <div
        v-if="keyPairsStore.recoveryPhraseWords.length > 0"
        class="row justify-content-end mt-6"
      >
        <div class="col-4">
          <AppButton
            color="primary"
            class="w-100"
            @click="handleNext"
          >
            Next
          </AppButton>
        </div>
      </div>
    </template>
  </div>
</template>
