<script setup lang="ts">
import type { FileCreateData } from '@renderer/utils/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';
import FileDataFormData from '@renderer/components/Transaction/Create/FileData/FileDataFormData.vue';

/* Props */
defineProps<{
  data: FileCreateData;
  fileName: string;
  description: string;
}>();

/* Emits */
defineEmits<{
  (event: 'update:data', data: FileCreateData): void;
  (event: 'update:fileName', name: string): void;
  (event: 'update:description', description: string): void;
}>();
</script>
<template>
  <FileDataFormData
    :data="data"
    @update:data="
      $emit('update:data', {
        ...data,
        ...$event,
      })
    "
    :keyRequired="true"
  />

  <div class="row mt-6">
    <div class="form-group col-4 col-xxxl-3">
      <label class="form-label">Name</label>

      <div class="">
        <AppInput
          :model-value="fileName"
          @update:model-value="$emit('update:fileName', $event)"
          :filled="true"
          data-testid="input-file-name-for-file-create"
          placeholder="Enter File Name"
        />
      </div>
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-12 col-xl-8">
      <label class="form-label">Description</label>
      <textarea
        :value="description"
        @change="$emit('update:description', ($event.target as HTMLTextAreaElement).value)"
        class="form-control is-fill"
        rows="5"
        data-testid="input-file-description-for-file-create"
        placeholder="Enter File Description"
      ></textarea>
    </div>
  </div>
</template>
