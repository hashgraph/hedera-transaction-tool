<script setup lang="ts">
import type { RegisteredNodeData, RegisteredNodeUpdateData } from '@renderer/utils/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';
import RegisteredNodeFormData from '@renderer/components/Transaction/Create/RegisteredNodeCreate/RegisteredNodeFormData.vue';

/* Props */
const props = defineProps<{
  data: RegisteredNodeUpdateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: RegisteredNodeUpdateData): void;
}>();

/* Handlers */
const handleRegisteredNodeDataUpdate = (data: RegisteredNodeData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};
</script>

<template>
  <!-- Registered Node ID -->
  <div class="form-group mt-6 col-8 col-xxxl-6">
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

  <RegisteredNodeFormData :data="data" @update:data="handleRegisteredNodeDataUpdate" />
</template>
