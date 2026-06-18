<script setup lang="ts">
import { ref, watch } from 'vue';
import { computedAsync } from '@vueuse/core';

import { DISPLAY_FILE_SIZE_LIMIT } from '@shared/constants';
import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';

import { safeAwait } from '@renderer/utils';

import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';

/* Props */
const props = defineProps<{
  fileId?: string;
  contents: Uint8Array | string | null;
  accept?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:contents', contents: Uint8Array | string | null): void;
}>();

/* State */
const manualContent = ref('');
const file = ref<{
  meta: File;
  content: Uint8Array;
  loadPercentage: number;
} | null>(null);

/* Computed */
const displayedFileText = computedAsync(async () => {
  if (file.value === null || file.value.content.length === 0) return null;
  if (file.value.meta.size > DISPLAY_FILE_SIZE_LIMIT) return '';
  if (isHederaSpecialFileId(props.fileId)) {
    const { data, error } = await safeAwait(
      window.electronAPI.local.files.decodeProto(props.fileId, file.value.content),
    );
    if (error) return '';
    return data ?? null;
  }
  return new TextDecoder().decode(file.value.content);
}, null);

/* Watchers */
watch(file, () => {
  manualContent.value = '';
});
watch(
  () => props.fileId,
  id => {
    if (isHederaSpecialFileId(id) && !file.value?.meta.name.endsWith('.bin')) {
      file.value = null;
      manualContent.value = '';
    }
  },
);
watch([file, manualContent], () => {
  emit(
    'update:contents',
    manualContent.value.length > 0 ? manualContent.value : file.value?.content || null,
  );
});
</script>
<template>
  <div class="mt-6 form-group">
    <AppUploadFile
      id="append-transaction-file"
      data-testid="button-upload-file"
      show-name
      show-progress
      v-model:file="file"
      :accept="accept"
      :disabled="manualContent.length > 0"
      :max-size-kb="512"
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
        data-testid="textarea-file-read-content"
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
</template>
