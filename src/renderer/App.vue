<script setup lang="ts">
import { onMounted } from 'vue';
import StyleGuide from './components/StyleGuide.vue';
import AppMenu from './components/AppMenu.vue';

onMounted(async () => {
  const isDark = await window.electronAPI.theme.isDark();
  document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');

  window.electronAPI.theme.onThemeUpdate(isDark =>
    document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light'),
  );
});

async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();
  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}
</script>

<template>
  <div class="container my-10">
    <h1 class="mb-5">Hedera Transaction Tool</h1>
    <button class="btn btn-primary btn-sm" @click="handleThemeChange">Toggle Theme</button>
    <AppMenu />
    <StyleGuide />
  </div>
</template>
