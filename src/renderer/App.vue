<script setup lang="ts">
import { onMounted } from 'vue';
import AppMenu from './components/Menu.vue';
import AppHeader from './components/Header.vue';

onMounted(async () => {
  const isDark = await window.electronAPI.theme.isDark();
  document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');

  window.electronAPI.theme.onThemeUpdate(isDark =>
    document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light'),
  );
});
</script>

<template>
  <AppHeader />
  <div class="container-main">
    <AppMenu />
    <RouterView v-slot="{ Component }" class="flex-1">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
