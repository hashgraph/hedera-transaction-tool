<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { isOrganizationActive } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const inactiveSelectedOrganizationModalShown = ref(false);
const organizationNickname = ref<string | null>(null);
const organizationUrl = ref<string | null>(null);

/* Handlers */
const handleSelectedOrganizationNotActiveSubmit = async () => {
  inactiveSelectedOrganizationModalShown.value = false;
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  selectedOrganization => {
    if (!selectedOrganization) return;

    if (!isOrganizationActive(selectedOrganization)) {
      inactiveSelectedOrganizationModalShown.value = true;

      const nickname = user.organizations.find(
        organization => organization.serverUrl === selectedOrganization.serverUrl,
      )?.nickname;
      organizationNickname.value = nickname || null;
      organizationUrl.value = selectedOrganization.serverUrl;
    }
  },
);
</script>
<template>
  <AppModal
    v-model:show="inactiveSelectedOrganizationModalShown"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i
          class="bi bi-x-lg cursor-pointer"
          @click="inactiveSelectedOrganizationModalShown = false"
        ></i>
      </div>
      <form
        class="overflow-hidden mt-3"
        @submit.prevent="handleSelectedOrganizationNotActiveSubmit"
      >
        <h3 class="text-center text-title text-bold">Organization status error</h3>
        <p
          class="text-center text-small text-secondary mt-4"
          data-testid="p-organization-error-message"
        >
          {{ organizationNickname }} <span class="text-nobreak">is not reachable</span>
        </p>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton color="primary" data-testid="button-close-modal" type="submit"
            >Close</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
