<script setup lang="ts">
import type { Key } from '@hashgraph/sdk';
import type { FileAppendData } from '@renderer/utils/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization, isHederaSpecialFileId, formatAccountId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import FileContentFormData from '@renderer/components/Transaction/Create/FileData/FileContentFormData.vue';

/* Props */
const props = defineProps<{
  data: FileAppendData;
  signatureKey: Key | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: FileAppendData): void;
  (event: 'update:signatureKey', key: Key | null): void;
}>();

/* Stores */
const user = useUserStore();

/* Handlers */
function handleOnBlur() {
  emit('update:data', { ...props.data, fileId: formatAccountId(props.data.fileId) });
}

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">File ID <span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.fileId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            fileId: $event,
          })
        "
        @blur="handleOnBlur"
        :filled="true"
        placeholder="Enter File ID"
        data-testid="input-file-id-for-append"
      />
    </div>
  </div>

  <div v-if="!isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <KeyField
        :model-key="signatureKey"
        @update:model-key="$emit('update:signatureKey', $event)"
        is-required
        label="Signature Key"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Chunk Size</label>
      <AppInput
        :model-value="data.chunkSize"
        @update:model-value="
          $emit('update:data', {
            ...data,
            chunkSize: Number($event),
          })
        "
        :filled="true"
        type="number"
        min="1024"
        max="6144"
        placeholder="Enter Chunk Size"
      />
    </div>
  </div>

  <FileContentFormData
    :file-id="data.fileId"
    :contents="data.contents"
    @update:contents="
      $emit('update:data', {
        ...data,
        contents: $event,
      })
    "
    :accept="isHederaSpecialFileId(data.fileId) ? '.bin' : '*'"
  />
</template>
