<script setup lang="ts">
import txTypeComponentMapping from './txTypeComponentMapping';
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
