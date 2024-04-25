<script setup lang="ts">
import { onMounted, ref } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';

import useAutoLogin from '@renderer/composables/useAutoLogin';

import { getExchangeRateSet } from './services/mirrorNodeDataService';
import { setClient } from './services/transactionService';

import { provideUserModalRef } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import AppUpdate from '@renderer/components/AppUpdate.vue';
import ImportantNote from '@renderer/components/ImportantNote.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';
import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import OrganizationStatusModal from '@renderer/components/Organization/OrganizationStatusModal.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Composables */
useAutoLogin();

/* State */
const userPasswordModalRef = ref<InstanceType<typeof UserPasswordModal> | null>(null);

/* Handlers */
async function handleThemeChange() {
  const isDark = await window.electronAPI.local.theme.isDark();
  window.electronAPI.local.theme.toggle(isDark ? 'light' : 'dark');
}

/* Hooks */
onMounted(async () => {
  const isDark = await window.electronAPI.local.theme.isDark();
  document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');

  window.electronAPI.local.theme.onThemeUpdate(theme =>
    document.body.setAttribute('data-bs-theme', theme.shouldUseDarkColors ? 'dark' : 'light'),
  );
});

/* Hooks */
onMounted(async () => {
  network.exchangeRateSet = await getExchangeRateSet(network.mirrorNodeBaseURL);
  await setClient(network.network);
});

/* Providers */
provideUserModalRef(userPasswordModalRef);
</script>

<template>
  <AppHeader
    :class="{
      'logged-in': user.personal?.isLoggedIn && !user.selectedOrganization?.loginRequired,
      'should-setup-account': user.shouldSetupAccount,
    }"
  />

  <Transition name="fade" mode="out-in">
    <div
      v-if="user.personal"
      class="container-main"
      :class="{
        'logged-in': user.personal?.isLoggedIn && !user.selectedOrganization?.loginRequired,
        'should-setup-account': user.shouldSetupAccount,
      }"
    >
      <AppMenu
        v-if="
          user.personal?.isLoggedIn &&
          !user.selectedOrganization?.loginRequired &&
          !user.shouldSetupAccount
        "
      />
      <RouterView v-slot="{ Component }" class="flex-1 overflow-hidden container-main-content">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>

      <OrganizationStatusModal />
      <UserPasswordModal ref="userPasswordModalRef" />
    </div>
  </Transition>

  <AutoLoginInOrganization />

  <!-- To be removed -->
  <AppButton class="btn-theme-changer" color="secondary" @click="handleThemeChange">
    <i class="bi bi-sun"></i
  ></AppButton>

  <AppUpdate />
  <ImportantNote />
</template>
