<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { tryAutoSignIn } from '@renderer/services/organizationCredentials';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const checked = ref(false);
const loginsSummaryModalShow = ref(false);
const loginFailedForOrganizations = ref<Organization[]>([]);
const loginTriedForOrganizations = ref<Organization[]>([]);

/* Handlers */
const handleAutoLogin = async (password: string | null) => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  if (!user.personal.useKeychain && !password) throw new Error('Password is required');

  loginFailedForOrganizations.value = await tryAutoSignIn(user.personal.id, password);
  loginTriedForOrganizations.value = user.organizations
    .filter(org => org.loginRequired)
    .map(org => ({ id: org.id, nickname: org.nickname, serverUrl: org.serverUrl, key: org.key }));

  loginsSummaryModalShow.value = true;

  await user.refetchOrganizations();
};

const handleSubmitFailedOrganizations = (e: Event) => {
  e.preventDefault();
  loginsSummaryModalShow.value = false;
};

/* Functions */
async function openPasswordModalIfRequired() {
  if (isUserLoggedIn(user.personal)) {
    const organizationToSignIn = user.organizations.filter(org => org.loginRequired);

    if (organizationToSignIn.length === 0) return;

    const personalPassword = getPassword(handleAutoLogin, {
      subHeading: 'Sign in to your organizations with expired token',
    });
    if (passwordModalOpened(personalPassword)) return;

    await handleAutoLogin(personalPassword || null);
  }
}

/* Watchers */
watch(
  () => user.organizations,
  async () => {
    if (!checked.value) {
      checked.value = true;
      await openPasswordModalIfRequired();
    }
  },
);
</script>
<template>
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
