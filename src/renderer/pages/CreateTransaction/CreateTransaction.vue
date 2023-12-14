<script setup lang="ts">
import txTypeComponentMapping from './txTypeComponentMapping';

import AppButton from '../../components/ui/AppButton.vue';
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Create Transaction</h1>
    <div class="mt-7 d-flex">
      <AppButton color="secondary" class="d-flex align-items-center" @click="$router.back()">
        <span>Back</span></AppButton
      >
    </div>
    <div class="mt-4">
      <template v-if="Object.keys(txTypeComponentMapping).includes($route.params.type.toString())">
        <Component
          :is="txTypeComponentMapping[$route.params.type.toString() as keyof typeof txTypeComponentMapping]"
        />
      </template>
    </div>
  </div>
</template>
