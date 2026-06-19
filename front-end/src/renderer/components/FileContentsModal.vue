<script setup lang="ts">
import { computed } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import { isHederaSpecialFileId, decodeProto } from '@shared/hederaSpecialFiles';
import { showSaveDialog, saveFileToPath } from '@renderer/services/electronUtilsService';
import { ToastManager } from '@renderer/utils/ToastManager';

const props = withDefaults(
  defineProps<{
    show: boolean;
    contents: Uint8Array;
    fileId?: string | null;
    title?: string;
    transactionId?: string | null;
  }>(),
  { title: 'File Contents' },
);

const emit = defineEmits(['update:show']);

const toastManager = ToastManager.inject();

const handleShowUpdate = (show: boolean) => emit('update:show', show);

const displayContent = computed<string | null>(() => {
  if (!props.contents?.length) return '';

  if (props.fileId && isHederaSpecialFileId(props.fileId)) {
    try {
      return decodeProto(props.fileId, props.contents) ?? '';
    } catch {
      return null;
    }
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(props.contents);
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
});

const isDecoded = computed(
  () =>
    !!(
      props.fileId &&
      isHederaSpecialFileId(props.fileId) &&
      displayContent.value !== null &&
      displayContent.value !== ''
    ),
);

const fileExtension = computed(() => {
  if (props.fileId && isHederaSpecialFileId(props.fileId)) {
    return 'bin'; // raw bytes are protobuf-encoded regardless of how they're displayed
  }
  return displayContent.value !== null ? 'txt' : 'bin';
});

const suggestedFilename = computed(() => {
  const base = props.transactionId ? `${props.transactionId}-file-contents` : 'file-contents';
  return `${base}.${fileExtension.value}`;
});

const handleDownload = async () => {
  try {
    const ext = fileExtension.value;
    const result = await showSaveDialog(
      suggestedFilename.value,
      'Save File',
      'Save',
      [
        { name: `${ext.toUpperCase()} Files`, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
      '',
    );
    if (result.canceled || !result.filePath) return;
    await saveFileToPath(props.contents, result.filePath);
  } catch {
    toastManager.error('Failed to download file');
  }
};
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleShowUpdate"
    :class="isDecoded ? 'large-modal' : 'medium-modal'"
  >
    <div v-if="show" class="p-4">
      <!-- Header: X left, title centered -->
      <div class="d-flex align-items-center mb-4">
        <i class="bi bi-x-lg cursor-pointer" @click="handleShowUpdate(false)"></i>
        <h5 class="text-title text-bold text-center flex-grow-1 m-0">{{ props.title }}</h5>
        <span style="width: 1em"></span>
      </div>
      <!-- Content -->
      <div
        class="border rounded p-3"
        style="background-color: rgba(0, 0, 0, 0.04)"
      >
        <pre
          v-if="displayContent !== null"
          class="m-0 overflow-auto text-small"
          style="max-height: 55vh; white-space: pre-wrap; word-break: break-all"
          >{{ displayContent || '(empty)' }}</pre
        >
        <p v-else class="m-0 text-small">Binary content — cannot display</p>
      </div>
      <!-- Footer -->
      <div class="d-flex align-items-center justify-content-between mt-4">
        <span v-if="isDecoded" class="text-small text-secondary fst-italic">
          <sup>*</sup>Decoded
        </span>
        <span v-else></span>
        <button class="btn btn-link p-0 text-small" @click="handleDownload">
          download original content
        </button>
      </div>
    </div>
  </AppModal>
</template>
