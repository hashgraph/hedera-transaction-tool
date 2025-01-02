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

/* Handlers */

const handleSelectedOrganizationNotActiveSubmit = async (e: Event) => {
  e.preventDefault();

  inactiveSelectedOrganizationModalShown.value = false;
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  selectedOrganization => {
    if (!selectedOrganization) return;

    if (!isOrganizationActive(selectedOrganization)) {
      inactiveSelectedOrganizationModalShown.value = true;
      throw new Error('Organization server is not reachable');
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
      <form class="mt-3" @submit="handleSelectedOrganizationNotActiveSubmit">
        <h3 class="text-center text-title text-bold">Organization status error</h3>
        <p
          class="text-center text-small text-secondary mt-4"
          data-testid="p-organization-error-message"
        >
          Organization server is not reachable
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
