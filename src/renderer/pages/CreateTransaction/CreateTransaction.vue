<script setup lang="ts">
import { useRoute } from 'vue-router';

import txTypeComponentMapping from './txTypeComponentMapping';

import AppButton from '../../components/ui/AppButton.vue';

const route = useRoute();

const handleCreateTransaction = () => {};
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Create Transaction</h1>
    <div class="mt-7 d-flex justify-content-end">
      <AppButton
        color="secondary"
        class="rounded-4 d-flex align-items-center"
        @click="handleCreateTransaction"
      >
        <span>Create</span> <i class="bi bi-plus text-subheader"></i
      ></AppButton>
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
