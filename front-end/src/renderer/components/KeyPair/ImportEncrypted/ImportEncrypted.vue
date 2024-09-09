<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Functions */
function process() {
  console.log('Processing');
}

/* Expose */
defineExpose({ process });
</script>
<template>
  <div></div>
</template>
