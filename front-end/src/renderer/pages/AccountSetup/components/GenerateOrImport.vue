<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { hashRecoveryPhrase } from '@renderer/services/keyPairService';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import Generate from './Generate.vue';
import Import from './Import.vue';

/* Props */
const props = defineProps<{
  handleNext: () => void;
}>();

/* Stores */
const importRef = ref<InstanceType<typeof Import> | null>(null);
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* State */
const tabItems = ref<TabItem[]>([{ title: 'Create New' }, { title: 'Import Existing' }]);
const activeTabIndex = ref(1);
const differentSecretHashModalShown = ref(false);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Handlers */
const handleNextWithValidation = async () => {
  const secretHash = await hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);

  if (
    user.data.organizationState?.secretHashes &&
    !user.data.organizationState.secretHashes.includes(secretHash)
  ) {
    differentSecretHashModalShown.value = true;
  } else {
    props.handleNext();
  }
};

const handleSubmitDifferentSecretHashDecision = async (e: Event) => {
  e.preventDefault();

  //DELETE KEYS IN BACKEND

  props.handleNext();
};

/* Hooks */
onBeforeMount(() => {
  if (user.data.organizationServerActive) {
    if (
      user.data.organizationState?.secretHashes &&
      user.data.organizationState?.secretHashes.length > 0
    ) {
      tabItems.value.shift();
    }
  } else {
    user.data.secretHashes.length > 0 && tabItems.value.shift();
  }
  activeTabIndex.value = tabItems.value.findIndex(i => i.title === 'Import Existing');
});
</script>
<template>
  <div class="fill-remaining mt-4">
    <AppTabs
      :items="tabItems"
      v-model:activeIndex="activeTabIndex"
      class="w-100"
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
          @click="handleNextWithValidation"
          >Next</AppButton
        >
      </div>
      <AppModal
        v-model:show="differentSecretHashModalShown"
        :close-on-click-outside="false"
        :close-on-escape="false"
        class="common-modal"
      >
        <form class="p-4" @submit="handleSubmitDifferentSecretHashDecision">
          <div class="text-start">
            <i class="bi bi-x-lg cursor-pointer" @click="differentSecretHashModalShown = false"></i>
          </div>
          <div class="text-center">
            <AppCustomIcon :name="'bin'" style="height: 160px" />
          </div>
          <h2 class="text-center text-title text-semi-bold mt-3">
            Delete Existing Organization Keys
          </h2>
          <p class="text-center text-small text-secondary mt-3">
            The recovery phrase you entered is not the same as the one used in the organization. If
            you wish to proceed, the existing keys will be deleted.
          </p>

          <hr class="separator my-5" />

          <div class="flex-between-centered gap-4">
            <AppButton
              color="borderless"
              type="button"
              @click="differentSecretHashModalShown = false"
              >Cancel</AppButton
            >
            <AppButton color="danger" type="submit">Next</AppButton>
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>
