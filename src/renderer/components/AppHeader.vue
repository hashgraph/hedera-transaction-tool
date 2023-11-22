<script setup lang="ts">
import logo from '../images/logo.svg';
import logoText from '../images/logo-text.svg';

async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();
  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}
</script>

<template>
  <div class="container-header">
    <div>
      <img :src="logo" alt="" />
      <img :src="logoText" alt="" />
    </div>
    <div>
      <button class="btn btn-primary btn-sm" @click="handleThemeChange">Toggle Theme</button>
    </div>
  </div>
</template>
