<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';
import useThemeStore from '@renderer/stores/storeTheme';

import {
  provideDynamicLayout,
  provideGlobalModalLoaderlRef,
  provideUserModalRef,
} from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';
import OrganizationStatusModal from '@renderer/components/Organization/OrganizationStatusModal.vue';
import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';
import GlobalAppProcesses from '@renderer/components/GlobalAppProcesses';
import { AccountByPublicKeyCache } from '@renderer/caches/mirrorNode/AccountByPublicKeyCache.ts';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { TransactionByIdCache } from '@renderer/caches/mirrorNode/TransactionByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';

/* Composables */
const router = useRouter();

/* Stores */
const user = useUserStore();
const theme = useThemeStore();

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
  window.electronAPI.local.settings.onSettings(() => {
    router.push('/settings/general').then();
  });
});

/* Providers */
provideUserModalRef(userPasswordModalRef);
provideGlobalModalLoaderlRef(globalModalLoaderRef);
provideDynamicLayout(dynamicLayout);
AccountByIdCache.provide();
AccountByPublicKeyCache.provide();
TransactionByIdCache.provide();
NodeByIdCache.provide();
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
      <RouterView
        v-slot="{ Component }"
        :key="$route.fullPath"
        class="flex-1 overflow-hidden container-main-content"
      >
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>

      <OrganizationStatusModal />
      <UserPasswordModal ref="userPasswordModalRef" />
      <GlobalModalLoader ref="globalModalLoaderRef" />
    </div>
  </Transition>

  <!-- To be removed -->
  <AppButton class="btn-theme-changer" color="secondary" @click="handleThemeChange">
    <i class="bi bi-sun"></i
  ></AppButton>

  <GlobalAppProcesses />
</template>
