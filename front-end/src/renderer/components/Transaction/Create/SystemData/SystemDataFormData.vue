<script setup lang="ts">
import type { SystemData } from '@renderer/utils/sdk';

import { formatAccountId, formatContractId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
defineProps<{
  data: SystemData;
  required?: boolean;
}>();

defineEmits<{
  (event: 'update:data', data: SystemData): void;
}>();

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
            fileId: formatAccountId($event),
          })
        "
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
            contractId: formatContractId($event),
          })
        "
        :filled="true"
        placeholder="Enter Contract ID"
        data-testid="input-contract-id"
      />
    </div>
  </div>
</template>
