<script setup lang="ts">
import type { KeyPair } from '@prisma/client';
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';

import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils';

import AppTabs from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import Generate from './Generate.vue';
import UseExistingKey from './UseExistingKey.vue';

/* Props */
defineProps<{
  selectedPersonalKeyPair: KeyPair | null;
  handleNext: () => void;
}>();

/* Emits */
const emit = defineEmits(['update:selectedPersonalKeyPair']);

/* Stores */
const user = useUserStore();

/* Constants */
const createNewTitle = 'Create New';
const importExistingTitle = 'Import Existing';
const useExistingKeyTitle = 'Use Existing Key';

/* State */
const tabItems = ref<TabItem[]>([
  { title: createNewTitle },
  { title: importExistingTitle },
  { title: useExistingKeyTitle },
]);
const activeTabIndex = ref(1);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Handlers */
const handleClearWords = () => (user.recoveryPhrase = null);

/* Hooks */
onBeforeMount(() => {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    user.secretHashes.length > 0 && tabItems.value.shift();
    tabItems.value.pop();
  } else {
    user.selectedOrganization.secretHashes.length > 0 && tabItems.value.shift();
    user.selectedOrganization.userKeys.length > 0 && tabItems.value.pop();
  }

  activeTabIndex.value = tabItems.value.findIndex(i => i.title === importExistingTitle);
});

/* Watchers */
watch(activeTabTitle, newTitle => {
  if (newTitle !== useExistingKeyTitle) {
    emit('update:selectedPersonalKeyPair', null);
  }
});
</script>
<template>
  <div class="flex-column-100 overflow-hidden mt-4">
    <AppTabs
      :items="tabItems"
      v-model:activeIndex="activeTabIndex"
      class="w-100"
      nav-item-class="flex-1"
      nav-item-button-class="justify-content-center"
    ></AppTabs>
    <div class="fill-remaining overflow-x-auto mt-6">
      <template v-if="activeTabTitle === createNewTitle">
        <Generate :handle-next="handleNext" />
      </template>
      <template v-else-if="activeTabTitle === importExistingTitle">
        <Import />
        <div class="flex-between-centered mt-6">
          <AppButton data-testid="button-clear" color="borderless" @click="handleClearWords"
            >Clear</AppButton
          >
          <AppButton
            :disabled="user.recoveryPhrase === null"
            color="primary"
            @click="handleNext"
            data-testid="button-next-import"
            >Next</AppButton
          >
        </div>
      </template>
      <template v-else-if="activeTabTitle === useExistingKeyTitle">
        <UseExistingKey
          :selected-personal-key-pair="selectedPersonalKeyPair"
          @update:selected-personal-key-pair="emit('update:selectedPersonalKeyPair', $event)"
        />
      </template>
    </div>
  </div>
</template>
