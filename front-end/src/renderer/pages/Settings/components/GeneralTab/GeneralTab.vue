<script setup lang="ts">
import DefaultSettings from './components/DefaultSettings.vue';
import AppearanceSettings from './components/AppearanceSettings.vue';
import AppInfo from './components/AppInfo.vue';
</script>
<template>
  <div>
    <!-- Network -->
<!--    <NetworkSettings />-->

    <!-- Appearance -->
    <AppearanceSettings />

    <!-- Default Settings -->
    <DefaultSettings />

    <!-- App Info -->
    <AppInfo />
  </div>
</template>
