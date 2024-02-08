<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
withDefaults(
  defineProps<{
    handleSign?: () => void;
    createRequirements?: any;
    headingText?: string;
    buttonText?: string;
    buttonType?: string;
  }>(),
  {
    buttonText: 'Sign & Submit',
    buttonType: 'submit',
  },
);
</script>
<template>
  <div class="d-flex justify-content-between align-items-center">
    <h2 class="text-title text-bold">{{ headingText }}</h2>

    <div class="d-flex justify-content-end align-items-center">
      <AppButton
        color="primary"
        :type="buttonType"
        :disabled="createRequirements"
        @click="handleSign"
        >{{ buttonText }}</AppButton
      >
    </div>
  </div>
</template>
