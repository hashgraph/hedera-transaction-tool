<script setup lang="ts">
import { ref, watch } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import {
  getOrganizationsToSignIn,
  tryAutoSignIn,
} from '@renderer/services/organizationCredentials';
import { ping } from '@renderer/services/organization';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const userPasswordModalShow = ref(false);
const loginsSummaryModalShow = ref(false);
const loginFailedForOrganizations = ref<Organization[]>([]);
const loginTriedForOrganizations = ref<Organization[]>([]);

/* Handlers */
const handleAutoLogin = async (password: string) => {
  loginFailedForOrganizations.value = await tryAutoSignIn(user.data.id, password);
  loginTriedForOrganizations.value = user.data.organizationsToSignIn.map(
    orgCr => orgCr.organization,
  );

  loginsSummaryModalShow.value = true;
  user.data.organizationsToSignIn = await getOrganizationsToSignIn(user.data.id);
};

const handleSubmitFailedOrganizations = (e: Event) => {
  e.preventDefault();

  loginsSummaryModalShow.value = false;
};

/* Functions */
async function openPasswordModalIfRequired() {
  if (user.data.isLoggedIn && user.data.id.length > 0) {
    const organizationCredentialsToUpdate = await getOrganizationsToSignIn(user.data.id);

    const activeOrganizations: Organization[] = [];

    for (const cr of organizationCredentialsToUpdate) {
      const active = await ping(cr.organization.serverUrl);
      if (active) activeOrganizations.push(cr.organization);
    }

    if (organizationCredentialsToUpdate.length > 0 && activeOrganizations.length > 0) {
      userPasswordModalShow.value = true;
    }
  }
}

/* Watchers */
watch(
  () => user.data.id,
  async () => {
    await openPasswordModalIfRequired();
  },
);
</script>
<template>
  <UserPasswordModal
    subHeading="Sign in to your organizations with expired token"
    v-model:show="userPasswordModalShow"
    @passwordEntered="handleAutoLogin"
  />
  <AppModal
    v-model:show="loginsSummaryModalShow"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="loginsSummaryModalShow = false"></i>
      </div>
      <form class="mt-3" @submit="handleSubmitFailedOrganizations">
        <h3 class="text-center text-title text-bold">Organizations summary</h3>
        <div class="mt-4">
          <template v-for="org in loginTriedForOrganizations" :key="org.id">
            <div class="row align-items-center">
              <div class="col-10">
                <p class="text-small stext-truncate">{{ org.nickname }}</p>
              </div>
              <div class="col-2">
                <p class="text-micro">
                  <span
                    class="text-danger"
                    v-if="
                      loginFailedForOrganizations.some(
                        inactiveServer => inactiveServer.id === org.id,
                      )
                    "
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
</template>
