<script setup lang="ts">
import type { SystemData } from '@renderer/utils/sdk';

import { formatAccountId, formatContractId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  data: SystemData;
  required?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:data', data: SystemData): void;
}>();

/* Handlers */
function handleFileOnBlur() {
  emit('update:data', { ...props.data, fileId: formatAccountId(props.data.fileId) });
}

function handleContractOnBlur() {
  emit('update:data', { ...props.data, fileId: formatContractId(props.data.fileId) });
}

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">File ID <span v-if="required" class="text-danger">*</span></label>
      <AppInput
        :model-value="data.fileId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            fileId: $event,
          })
        "
        @blur="handleFileOnBlur"
        :filled="true"
        placeholder="Enter File ID"
        data-testid="input-file-id-for-update"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Contract ID <span v-if="required" class="text-danger">*</span></label
      >
      <AppInput
        :model-value="data.contractId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            contractId: $event,
          })
        "
        @blur="handleContractOnBlur"
        :filled="true"
        placeholder="Enter Contract ID"
        data-testid="input-contract-id"
      />
    </div>
  </div>
</template>
