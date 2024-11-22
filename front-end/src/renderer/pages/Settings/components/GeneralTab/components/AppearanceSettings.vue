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
    <div class="btn-group-container d-inline-flex mw-100 mt-4" role="group">
      <div class="btn-group gap-3 overflow-x-auto pb-2">
        <template v-for="themeItem of themes" :key="themeItem">
          <AppButton
            class="rounded-3"
            :class="{ active: theme === themeItem, 'text-body': theme !== themeItem }"
            :color="theme === themeItem ? 'primary' : undefined"
            @click="handleThemeChange(themeItem)"
            :data-testid="`tab-appearance-${themeItem}`"
            >{{ themeNames[themeItem] }}</AppButton
          >
        </template>
      </div>
    </div>
  </div>
</template>
