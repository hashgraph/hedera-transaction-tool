<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairs from '@renderer/stores/storeKeyPairs';

import useAutoLogin from '@renderer/composables/useAutoLogin';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import AppUpdate from '@renderer/components/AppUpdate.vue';
import ImportantNote from '@renderer/components/ImportantNote.vue';
import AutoLoginInOrganization from './components/Organization/AutoLoginInOrganization.vue';
// import PingOrganizations from '@renderer/components/Organization/PingOrganizations.vue';

/* Composables */
const isCheckingUserState = useAutoLogin();

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairs();

/* State */
const isReady = ref(false);

/* Handlers */
async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();
  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}

/* Hooks */
onMounted(async () => {
  const isDark = await window.electronAPI.theme.isDark();
  document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');

  window.electronAPI.theme.onThemeUpdate(theme =>
    document.body.setAttribute('data-bs-theme', theme.shouldUseDarkColors ? 'dark' : 'light'),
  );
});

/* Watchers */
watch([isCheckingUserState, () => keyPairs.refetching], ([isChecking, fetching]) => {
  if (!isChecking && !fetching) {
    isReady.value = true;
  }
});
</script>

<template>
  <AppHeader
    :class="{
      'logged-in': user.data.isLoggedIn && !user.data.isSigningInOrganization,
      'should-setup-account': user.data.secretHashes.length === 0,
    }"
  />

  <Transition name="fade" mode="out-in">
    <div
      v-if="isReady"
      class="container-main"
      :class="{
        'logged-in': user.data.isLoggedIn && !user.data.isSigningInOrganization,
        'should-setup-account': user.data.secretHashes.length === 0,
      }"
    >
      <AppMenu
        v-if="
          user.data.isLoggedIn &&
          user.data.secretHashes.length > 0 &&
          !user.data.isSigningInOrganization
        "
      />
      <RouterView v-slot="{ Component }" class="flex-1 overflow-hidden container-main-content">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>

      <!-- <PingOrganizations /> -->
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
