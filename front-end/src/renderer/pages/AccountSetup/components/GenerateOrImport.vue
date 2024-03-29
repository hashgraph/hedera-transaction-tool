<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { deleteKey } from '@renderer/services/organization';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

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
const user = useUserStore();

/* State */
const tabItems = ref<TabItem[]>([{ title: 'Create New' }, { title: 'Import Existing' }]);
const activeTabIndex = ref(1);
const differentSecretHashModalShown = ref(false);

/* Getters */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Handlers */
const handleNextWithValidation = async () => {
  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase is not set');
  }

  if (
    isLoggedInOrganization(user.selectedOrganization) &&
    user.selectedOrganization.secretHashes.length > 0 &&
    !user.selectedOrganization.secretHashes.includes(user.recoveryPhrase.hash)
  ) {
    differentSecretHashModalShown.value = true;
  } else {
    props.handleNext();
  }
};

const handleSubmitDifferentSecretHashDecision = async (e: Event) => {
  e.preventDefault();

  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  const organizationKeysToDelete = user.selectedOrganization.userKeys.filter(k => k.mnemonicHash);

  for (let i = 0; i < organizationKeysToDelete.length; i++) {
    const key = organizationKeysToDelete[i];
    await deleteKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, key.id);
  }

  await user.refetchUserState();

  props.handleNext();
};

/* Hooks */
onBeforeMount(() => {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    user.secretHashes.length > 0 && tabItems.value.shift();
  } else if (user.selectedOrganization.secretHashes.length > 0) {
    tabItems.value.shift();
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
      <Import ref="importRef" :secret-hashes="user.secretHashes" />
      <div class="flex-between-centered mt-6">
        <AppButton color="borderless" @click="importRef?.clearWords()">Clear</AppButton>
        <AppButton
          v-if="user.recoveryPhrase"
          color="primary"
          @click="handleNextWithValidation"
          data-testid="button-next-import"
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
              data-testid="button-delete-cancel"
              >Cancel</AppButton
            >
            <AppButton data-testid="button-delete-next" color="danger" type="submit"
              >Next</AppButton
            >
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>
