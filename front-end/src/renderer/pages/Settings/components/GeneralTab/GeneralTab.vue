<script setup lang="ts">
import DefaultSettings from './components/DefaultSettings.vue';
import AppearanceSettings from './components/AppearanceSettings.vue';
import AppInfo from './components/AppInfo.vue';
import DeveloperSettings from '@renderer/pages/Settings/components/GeneralTab/components/DeveloperSettings.vue';
</script>
<template>
  <div>
    <!-- Developer -->
    <DeveloperSettings />

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
