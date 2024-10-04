<script setup lang="ts">
import type { ModelValue } from './components/MigrateForm.vue';

import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';
import MigrateForm from './components/MigrateForm.vue';

/* Composables */
useSetDynamicLayout({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* Handlers */
const handleFormSubmit = (value: ModelValue) => {
  console.log(value);
};

/* Functions */
</script>
<template>
  <div class="flex-column flex-centered flex-1 overflow-hidden p-6">
    <div
      class="container-dark-border flex-column-100 col-12 col-xl-8 col-xxl-7 bg-modal-surface glow-dark-bg p-5"
    >
      <h4 class="text-title text-semi-bold text-center">Migrate</h4>

      <p class="text-secondary text-small lh-base text-center mt-3">
        Fill the fields with the corresponding data to automatically migrate the data from the old
        tool to the new one
      </p>

      <div class="fill-remaining mt-4">
        <MigrateForm @submit="handleFormSubmit" />
      </div>
    </div>
  </div>
</template>
