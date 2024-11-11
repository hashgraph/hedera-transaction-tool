<script setup lang="ts">
import type { NodeData, NodeUpdateData } from '@renderer/utils/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';
import NodeFormData from '../NodeCreate/NodeFormData.vue';

/* Props */
const props = defineProps<{
  data: NodeUpdateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: NodeUpdateData): void;
}>();

/* Handlers */
const handleNodeDataUpdate = (data: NodeData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="form-group" :class="[columnClass]">
    <label class="form-label">Node ID <span class="text-danger">*</span></label>
    <AppInput
      :model-value="data.nodeId"
      @update:model-value="
        emit('update:data', {
          ...data,
          nodeId: $event,
        })
      "
      maxlength="2"
      class="form-control is-fill"
      placeholder="Enter Node ID"
    />
  </div>
  <NodeFormData :data="data" @update:data="handleNodeDataUpdate" />
</template>
