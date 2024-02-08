<script setup lang="ts">
import { onMounted } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import useUserStore from '@renderer/stores/storeUser';

import AppMenu from '@renderer/components/Menu.vue';
import AppHeader from '@renderer/components/Header.vue';
import AppUpdate from '@renderer/components/AppUpdate.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

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

  window.electronAPI.theme.onThemeUpdate(isDark =>
    document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light'),
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
  <div
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
    <AppButton class="btn-theme-changer" color="secondary" @click="handleThemeChange">
      <i class="bi bi-sun"></i
    ></AppButton>
    <AppUpdate />
  </div>
</template>
