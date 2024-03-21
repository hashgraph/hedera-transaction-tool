<script setup lang="ts">
import { onMounted } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';

import useAutoLogin from '@renderer/composables/useAutoLogin';

import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import AppUpdate from '@renderer/components/AppUpdate.vue';
import ImportantNote from '@renderer/components/ImportantNote.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Composables */
const isCheckingUserState = useAutoLogin();

/* Stores */
const user = useUserStore();

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
</script>

<template>
  <AppHeader
    :class="{
      'logged-in': user.data.isLoggedIn,
      'should-setup-account': user.data.secretHashes.length === 0,
    }"
  />

  <Transition name="fade" mode="out-in">
    <div
      v-if="!isCheckingUserState"
      class="container-main"
      :class="{
        'logged-in': user.data.isLoggedIn,
        'should-setup-account': user.data.secretHashes.length === 0,
      }"
    >
      <AppMenu v-if="user.data.isLoggedIn && user.data.secretHashes.length > 0" />
      <RouterView v-slot="{ Component }" class="flex-1 overflow-hidden container-main-content">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </Transition>

  <!-- To be removed -->
  <AppButton class="btn-theme-changer" color="secondary" @click="handleThemeChange">
    <i class="bi bi-sun"></i
  ></AppButton>

  <AppUpdate />
  <ImportantNote />
</template>
