<script setup lang="ts">
import txTypeComponentMapping from './txTypeComponentMapping';

import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

/* Composables */
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});
</script>

<template>
  <div class="p-5">
    <template v-if="Object.keys(txTypeComponentMapping).includes($route.params.type.toString())">
      <Component
        :is="
          txTypeComponentMapping[
            $route.params.type.toString() as keyof typeof txTypeComponentMapping
          ]
        "
      />
    </template>
  </div>
</template>
