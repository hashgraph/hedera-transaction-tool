<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

import txTypeComponentMapping from './txTypeComponentMapping';

import AppButton from '../../components/ui/AppButton.vue';

const route = useRoute();
const router = useRouter();

const handleBackButton = () => {
  router.back();
};
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">File Transaction</h1>
    <div class="mt-7 d-flex">
      <AppButton color="secondary" class="d-flex align-items-center" @click="handleBackButton">
        <span>Back</span></AppButton
      >
    </div>
    <div class="mt-4">
      <template v-if="Object.keys(txTypeComponentMapping).includes(route.params.type.toString())">
        <Component
          :is="txTypeComponentMapping[route.params.type.toString() as keyof typeof txTypeComponentMapping]"
        />
      </template>
    </div>
  </div>
</template>
