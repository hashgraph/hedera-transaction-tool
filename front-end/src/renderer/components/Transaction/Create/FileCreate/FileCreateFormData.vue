<script setup lang="ts">
import { DISPLAY_FILE_SIZE_LIMIT } from '@main/shared/constants';
import type { FileCreateData } from '@renderer/utils/sdk/createTransactions';

import { ref, watch } from 'vue';

import { getMinimumExpirationTime, getMaximumExpirationTime } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import KeyField from '@renderer/components/KeyField.vue';
import AppDatePicker from '@renderer/components/Wrapped/AppDatePicker.vue';

/* Props */
const props = defineProps<{
  data: FileCreateData;
  fileName: string;
  description: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: FileCreateData): void;
  (event: 'update:fileName', name: string): void;
  (event: 'update:description', description: string): void;
}>();

/* State */
const displayedFileText = ref<string | null>(null);
const manualContent = ref('');
const file = ref<{
  meta: File;
  content: Uint8Array;
  loadPercentage: number;
} | null>(null);

/* Handlers */
const handleFileLoadStart = () => {
  displayedFileText.value = null;
};

const handleFileLoadEnd = async () => {
  await syncDisplayedContent();
};

async function syncDisplayedContent() {
  if (file.value === null) {
    displayedFileText.value = null;
    return;
  }

  if (file.value && file.value.meta.size > DISPLAY_FILE_SIZE_LIMIT) {
    displayedFileText.value = '';
    return;
  }

  displayedFileText.value = new TextDecoder().decode(file.value.content);
}

/* Watchers */
watch([file, manualContent], () => {
  emit('update:data', {
    ...props.data,
    contents: manualContent.value.length > 0 ? manualContent.value : file.value?.content || null,
  });
});
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
        is-required
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
        data-testid="input-memo-for-file-create"
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

  <div class="mt-6 form-group">
    <AppUploadFile
      id="create-transaction-file"
      show-name
      show-progress
      v-model:file="file"
      :disabled="manualContent.length > 0"
      @load:start="handleFileLoadStart"
      @load:end="handleFileLoadEnd"
    />
  </div>

  <div class="row mt-6">
    <div class="form-group col-12 col-xl-8">
      <label class="form-label"
        >File Contents
        <span v-if="file && file.meta?.size > DISPLAY_FILE_SIZE_LIMIT">
          - the content is too big to be displayed</span
        ></label
      >
      <textarea
        v-if="Boolean(file)"
        :value="displayedFileText"
        data-testid="textarea-update-file-read-content"
        :disabled="true"
        class="form-control is-fill py-3"
        rows="10"
      ></textarea>
      <textarea
        v-else
        v-model="manualContent"
        :disabled="Boolean(file)"
        class="form-control is-fill"
        rows="10"
        data-testid="textarea-file-content"
      ></textarea>
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-4 col-xxxl-3">
      <label class="form-label">Name</label>

      <div class="">
        <AppInput
          :model-value="fileName"
          @update:model-value="emit('update:fileName', $event)"
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
        @change="emit('update:description', ($event.target as HTMLTextAreaElement).value)"
        class="form-control is-fill"
        rows="5"
        data-testid="input-file-description-for-file-create"
        placeholder="Enter File Description"
      ></textarea>
    </div>
  </div>
</template>
