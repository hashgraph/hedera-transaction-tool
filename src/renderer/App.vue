<script setup lang="ts">
import { onMounted } from 'vue';

import 'bootstrap/dist/js/bootstrap.bundle.min';

import AppMenu from './components/Menu.vue';
import AppHeader from './components/Header.vue';
import AppButton from './components/ui/AppButton.vue';
import useUserStore from './stores/storeUser';

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
  <AppHeader :class="{ 'logged-in': user.data.isLoggedIn }" />
  <div class="container-main" :class="{ 'logged-in': user.data.isLoggedIn }">
    <AppMenu v-if="user.data.isLoggedIn" />
    <RouterView v-slot="{ Component }" class="flex-1 overflow-hidden container-main-content">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <AppButton class="btn-theme-changer" color="secondary" @click="handleThemeChange">
      <i class="bi bi-sun"></i
    ></AppButton>
  </div>
</template>
