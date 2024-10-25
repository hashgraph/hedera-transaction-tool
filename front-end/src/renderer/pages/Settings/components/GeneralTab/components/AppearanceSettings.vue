<script setup lang="ts">
import type { Theme } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* State */
const theme = ref<Theme>('light');
const onUpdateUnsubscribe = ref<() => void>();

const handleThemeChange = (newTheme: Theme) => {
  window.electronAPI.local.theme.toggle(newTheme);
};

/* Hooks */
onBeforeMount(async () => {
  onUpdateUnsubscribe.value = window.electronAPI.local.theme.onThemeUpdate(
    (newTheme: { themeSource: Theme; shouldUseDarkColors: boolean }) => {
      document.body.setAttribute('data-bs-theme', newTheme.shouldUseDarkColors ? 'dark' : 'light');
      theme.value = newTheme.themeSource;
    },
  );
  theme.value = await window.electronAPI.local.theme.mode();
});

onBeforeUnmount(() => {
  if (onUpdateUnsubscribe.value) {
    onUpdateUnsubscribe.value();
  }
});
</script>
<template>
  <!-- Appearance -->
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>Appearance</p>
    <div class="mt-4 btn-group">
      <AppButton
        :color="'secondary'"
        data-testid="tab-appearance-dark"
        :class="{ active: theme === 'dark' }"
        @click="handleThemeChange('dark')"
        >Dark</AppButton
      >
      <AppButton
        :color="'secondary'"
        data-testid="tab-appearance-light"
        :class="{ active: theme === 'light' }"
        @click="handleThemeChange('light')"
        >Light</AppButton
      >
      <AppButton
        :color="'secondary'"
        data-testid="tab-appearance-system"
        :class="{ active: theme === 'system' }"
        @click="handleThemeChange('system')"
        >System</AppButton
      >
    </div>
  </div>
</template>
