<script setup lang="ts">
import { ref, watch } from 'vue';

import { DISPLAY_FILE_SIZE_LIMIT } from '@shared/constants';
import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';

import { safeAwait } from '@renderer/utils';

import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';

/* Props */
const props = defineProps<{
  fileId?: string;
  contents: Uint8Array | string | null;
  accept?: string;
  removeable?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:contents', contents: Uint8Array | string | null): void;
}>();

/* State */
const displayedFileText = ref<string | null>(null);
const manualContent = ref('');
const file = ref<{
  meta: File;
  content: Uint8Array;
  loadPercentage: number;
} | null>(null);
const removeContent = ref(false);

/* Handlers */
const handleFileLoadStart = () => {
  displayedFileText.value = null;
};

const handleFileLoadEnd = async () => {
  await syncDisplayedContent();
};

/* Functions */
async function syncDisplayedContent() {
  if (file.value === null) {
    displayedFileText.value = null;
    return;
  }

  if (file.value && file.value.meta.size > DISPLAY_FILE_SIZE_LIMIT) {
    displayedFileText.value = '';
    return;
  }

  if (isHederaSpecialFileId(props.fileId)) {
    const { data, error } = await safeAwait(
      window.electronAPI.local.files.decodeProto(props.fileId, file.value.content),
    );
    if (error) {
      displayedFileText.value = '';
      throw new Error('Failed to decode file');
    } else if (data) {
      displayedFileText.value = data;
    }
  } else {
    displayedFileText.value = new TextDecoder().decode(file.value.content);
  }
}

/* Watchers */
watch(manualContent, () => {
  removeContent.value = false;
});
watch(file, () => {
  manualContent.value = '';
  removeContent.value = false;
});
watch(
  () => props.fileId,
  async id => {
    if (isHederaSpecialFileId(id) && !file.value?.meta.name.endsWith('.bin')) {
      file.value = null;
      manualContent.value = '';
    }
    await syncDisplayedContent();
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

      <Transition v-if="removeable" name="fade" mode="out-in">
        <AppCheckBox
          v-if="manualContent.length === 0 && !file"
          v-model:checked="removeContent"
          label="Remove File Contents"
          name="remove-file-contents"
        />
      </Transition>

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
