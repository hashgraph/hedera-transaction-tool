<script setup lang="ts">
import type { Key } from '@hiero-ledger/sdk';
import type { FileAppendData } from '@renderer/utils/sdk';

import { computed } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization, formatAccountId } from '@renderer/utils';
import { getMaxChunkSize } from '@renderer/utils/sdk/privilegedPayer';

import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import FileContentFormData from '@renderer/components/Transaction/Create/FileData/FileContentFormData.vue';
import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';

/* Props */
const props = defineProps<{
  data: FileAppendData;
  signatureKey: Key | null;
  payerId?: string | null;
}>();

/* Computed */
// HIP-1300: privileged fee payers (0.0.2, 0.0.42-0.0.799) get a 128 KB limit,
// so the chunk-size cap grows accordingly. We use `getMaxChunkSize`, which
// subtracts the protobuf/signature overhead reserve so the resulting on-wire
// transaction stays safely within the per-transaction size envelope — the
// same reserve the big-file handlers apply when they build File Append
// transactions internally.
const chunkSizeMax = computed(() => getMaxChunkSize(props.payerId ?? null));

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
        :max="chunkSizeMax"
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
