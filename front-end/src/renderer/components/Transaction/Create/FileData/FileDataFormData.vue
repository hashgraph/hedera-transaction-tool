<script setup lang="ts">
import type { FileData } from '@renderer/utils';

import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';

import { getMinimumExpirationTime, getMaximumExpirationTime } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppDatePicker from '@renderer/components/ui/AppDatePicker.vue';
import KeyField from '@renderer/components/KeyField.vue';
import FileContentFormData from '@renderer/components/Transaction/Create/FileData/FileContentFormData.vue';

/* Props */
defineProps<{
  data: FileData;
  keyRequired: boolean;
  fileId?: string;
}>();

/* Emits */
defineEmits<{
  (event: 'update:data', data: FileData): void;
}>();
</script>
<template>
  <div class="row">
    <div class="form-group col-8 col-xxxl-6">
      <KeyField
        :model-key="data.ownerKey"
        @update:model-key="
          $emit('update:data', {
            ...data,
            ownerKey: $event,
          })
        "
        :is-required="keyRequired"
        :label="keyRequired ? 'Owner Key' : 'New Key'"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <label class="form-label">File Memo</label>
      <AppInput
        :model-value="data.fileMemo"
        @update:model-value="
          $emit('update:data', {
            ...data,
            fileMemo: $event,
          })
        "
        type="text"
        :filled="true"
        data-testid="input-file-memo"
        maxlength="100"
        placeholder="Enter file memo"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-4 col-xxxl-3">
      <label class="form-label"
        >Expiration <span class="text-muted text-italic">- Local time</span></label
      >
      <AppDatePicker
        :model-value="data.expirationTime ? data.expirationTime : undefined"
        @update:model-value="
          $emit('update:data', {
            ...data,
            expirationTime: $event,
          })
        "
        :minDate="getMinimumExpirationTime()"
        :maxDate="getMaximumExpirationTime()"
        clearable
        placeholder="Select Expiration Time"
        data-testid="input-expiration-time-for-file"
      />
    </div>
  </div>

  <FileContentFormData
    :file-id="fileId"
    :contents="data.contents"
    @update:contents="
      $emit('update:data', {
        ...data,
        contents: $event,
      })
    "
    :accept="isHederaSpecialFileId(fileId) ? '.bin' : '*'"
    removeable
  />
</template>
