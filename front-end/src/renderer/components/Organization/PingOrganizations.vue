<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { ping } from '@renderer/services/organization';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const inactiveServersModalShown = ref(false);
const inactiveSelectedOrganizationModalShown = ref(false);
const inactiveServers = ref<Organization[]>([]);

/* Handlers */
const handleInactiveServersSummarySubmit = async (e: Event) => {
  e.preventDefault();

  inactiveServersModalShown.value = false;
};

const handleSelectedOrganizationNotActiveSubmit = async (e: Event) => {
  e.preventDefault();

  inactiveSelectedOrganizationModalShown.value = false;
};

const checkInactiveServers = async (organizations: Organization[]) => {
  for (let i = 0; i < organizations.length; i++) {
    const organization = organizations[i];

    const active = await ping(organization.serverUrl);

    if (!active) {
      if (!inactiveServers.value.find(org => org.id === organization.id)) {
        inactiveServers.value.push(organization);
      }
    } else {
      inactiveServers.value = inactiveServers.value.filter(org => org.id !== organization.id);
    }
  }
};

/* Hooks */
onMounted(async () => {
  await checkInactiveServers(user.data.connectedOrganizations);

  // if (inactiveServers.value.length > 0) {
  // inactiveServersModalShown.value = true;
  // }
});

/* Watchers */
watch(
  () => user.data.activeOrganization,
  async activeOrganization => {
    if (!activeOrganization) return;
    const active = await ping(activeOrganization.serverUrl);

    if (!active) {
      if (!inactiveServers.value.find(org => org.id === activeOrganization.id)) {
        inactiveServers.value.push(activeOrganization);
      }
      inactiveSelectedOrganizationModalShown.value = true;
    } else {
      inactiveServers.value = inactiveServers.value.filter(org => org.id !== activeOrganization.id);
    }
  },
);
</script>
<template>
  <AppModal
    v-model:show="inactiveServersModalShown"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="inactiveServersModalShown = false"></i>
      </div>
      <form class="mt-3" @submit="handleInactiveServersSummarySubmit">
        <h3 class="text-center text-title text-bold">Organizations summary</h3>
        <div class="mt-4">
          <template v-for="org in user.data.connectedOrganizations" :key="org.id">
            <div class="row align-items-center">
              <div class="col-10">
                <p class="text-small stext-truncate">{{ org.nickname }}</p>
              </div>
              <div class="col-2">
                <p class="text-micro">
                  <span
                    class="text-danger"
                    v-if="inactiveServers.some(inactiveServer => inactiveServer.id === org.id)"
                    >●</span
                  >
                  <span v-else class="text-success">●</span>
                </p>
              </div>
            </div>
          </template>
        </div>

        <hr class="separator my-5" />
        <div class="d-grid">
          <AppButton color="primary" type="submit">Close</AppButton>
        </div>
      </form>
    </div>
  </AppModal>
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
        <p class="text-center text-small text-secondary mt-4">
          Organization server is not reachable
        </p>
        <hr class="separator my-5" />
        <div class="d-grid">
          <AppButton color="primary" type="submit">Close</AppButton>
        </div>
      </form>
    </div>
  </AppModal>
</template>
