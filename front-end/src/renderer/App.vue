<script setup lang="ts">
import { onErrorCaptured, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';

import {
  provideDynamicLayout,
  provideGlobalModalLoaderlRef,
  provideUserModalRef,
} from '@renderer/providers';

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
import { PublicKeyOwnerCache } from './caches/backend/PublicKeyOwnerCache';
import { ToastManager } from './utils/ToastManager';
import { createLogger, getErrorMessage } from '@renderer/utils';
import { BackendTransactionCache } from './caches/backend/BackendTransactionCache.ts';

/* Composables */
const router = useRouter();
const logger = createLogger('renderer.app');

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* State */
const userPasswordModalRef = ref<InstanceType<typeof UserPasswordModal> | null>(null);
const globalModalLoaderRef = ref<InstanceType<typeof GlobalModalLoader> | null>(null);
const dynamicLayout = reactive({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

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

onErrorCaptured((err: unknown) => {
  logger.error('Vue error captured', err);
  toastManager.error(getErrorMessage(err, 'An error occurred'));
});

/* Providers */
provideUserModalRef(userPasswordModalRef);
provideGlobalModalLoaderlRef(globalModalLoaderRef);
provideDynamicLayout(dynamicLayout);
AccountByIdCache.provide();
AccountByPublicKeyCache.provide();
TransactionByIdCache.provide();
NodeByIdCache.provide();
PublicKeyOwnerCache.provide();
BackendTransactionCache.provide();
ToastManager.provide();
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

  <GlobalAppProcesses />
</template>
