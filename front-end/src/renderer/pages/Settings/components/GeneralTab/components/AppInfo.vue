<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

/* State */
const version = ref('');

/* Hooks */
onBeforeMount(async () => {
  version.value = await window.electronAPI.local.update.getVersion();
});

/* Misc */
const itemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const itemValueClass = 'text-small overflow-hidden mt-1';
</script>
<template>
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>App Info</p>
    <div class="mt-4">
      <h4 :class="itemLabelClass">Version</h4>
      <p :class="itemValueClass">{{ version }}</p>
    </div>
  </div>
</template>
