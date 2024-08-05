<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useThemeStore from '@renderer/stores/storeTheme';

import useAutoLogin from '@renderer/composables/useAutoLogin';

import { getExchangeRateSet } from './services/mirrorNodeDataService';
import { setClient } from './services/transactionService';

import {
  provideDynamicLayout,
  provideGlobalModalLoaderlRef,
  provideUserModalRef,
} from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import AppUpdate from '@renderer/components/AppUpdate.vue';
import ImportantNote from '@renderer/components/ImportantNote.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';
import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import OrganizationStatusModal from '@renderer/components/Organization/OrganizationStatusModal.vue';
import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const theme = useThemeStore();

/* Composables */
useAutoLogin();

/* State */
const userPasswordModalRef = ref<InstanceType<typeof UserPasswordModal> | null>(null);
const globalModalLoaderRef = ref<InstanceType<typeof GlobalModalLoader> | null>(null);
const dynamicLayout = reactive({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* Handlers */
async function handleThemeChange() {
  const isDark = await window.electronAPI.local.theme.isDark();
  window.electronAPI.local.theme.toggle(isDark ? 'light' : 'dark');
  theme.changeThemeDark(!isDark);
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
provideGlobalModalLoaderlRef(globalModalLoaderRef);
provideDynamicLayout(dynamicLayout);
</script>

<template>
  <AppHeader
    :class="{
      'logged-in': dynamicLayout.loggedInClass,
      'should-setup-account': dynamicLayout.shouldSetupAccountClass,
    }"
  />

  <Transition name="fade" mode="out-in">
    <div
      v-if="user.personal"
      class="container-main"
      :class="{
        'logged-in': dynamicLayout.loggedInClass,
        'should-setup-account': dynamicLayout.shouldSetupAccountClass,
      }"
    >
      <AppMenu v-if="dynamicLayout.showMenu" />
      <RouterView v-slot="{ Component }" class="flex-1 overflow-hidden container-main-content">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>

      <OrganizationStatusModal />
      <UserPasswordModal ref="userPasswordModalRef" />
      <GlobalModalLoader ref="globalModalLoaderRef" />
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
