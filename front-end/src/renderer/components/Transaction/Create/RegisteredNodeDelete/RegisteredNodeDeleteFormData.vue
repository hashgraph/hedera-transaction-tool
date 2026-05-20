<script setup lang="ts">
import type { RegisteredNodeDeleteData } from '@renderer/utils/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
defineProps<{
  data: RegisteredNodeDeleteData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: RegisteredNodeDeleteData): void;
}>();

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="form-group" :class="[columnClass]">
    <label class="form-label">Registered Node ID <span class="text-danger">*</span></label>
    <AppInput
      :model-value="data.registeredNodeId"
      @update:model-value="
        emit('update:data', {
          ...data,
          registeredNodeId: $event,
        })
      "
      maxlength="2"
      class="form-control is-fill"
      placeholder="Enter Registered Node ID"
    />
  </div>
</template>
