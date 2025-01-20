<script setup lang="ts">
import type { Theme } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref } from 'vue';

import ButtonGroup from '@renderer/components/ui/ButtonGroup.vue';

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

/* Misc */
const themes: Theme[] = ['light', 'dark', 'system'];
const themeNames: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};
</script>
<template>
  <!-- Appearance -->
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>Appearance</p>
    <div class="d-inline-flex mw-100 mt-4">
      <ButtonGroup
        :items="
          themes.map(themeItem => ({
            label: themeNames[themeItem],
            value: themeItem,
            id: `tab-appearance-${themeItem}`,
          }))
        "
        :activeValue="theme"
        color="primary"
        @change="handleThemeChange"
      />
    </div>
  </div>
</template>
