<script setup lang="ts">
import Logo from './Logo.vue';
import LogoText from './LogoText.vue';

async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();

  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo />
      <LogoText />
    </div>
    <div>
      <div class="form-check form-switch">
        <input
          @change="handleThemeChange"
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="flexSwitchCheckDefault"
          checked
        />
        <label class="text-main text-primary" for="flexSwitchCheckDefault">Dark mode</label>
      </div>
    </div>
  </div>
</template>
