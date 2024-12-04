<script setup lang="ts">
import txTypeComponentMapping from '@renderer/components/Transaction/Create/txTypeComponentMapping';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

/* Composables */
useSetDynamicLayout(LOGGED_IN_LAYOUT);
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
