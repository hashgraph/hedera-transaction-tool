<script setup lang="ts">
import { computed } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import { isHederaSpecialFileId, decodeProto } from '@shared/hederaSpecialFiles';

const props = defineProps<{
  show: boolean;
  contents: Uint8Array;
  fileId?: string | null;
}>();

const emit = defineEmits(['update:show']);

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
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div v-if="show" class="p-5">
      <h3 class="text-center text-title text-bold mb-4">File Contents</h3>
      <pre
        v-if="displayContent !== null"
        class="m-0 overflow-auto text-small"
        style="max-height: 60vh; white-space: pre-wrap; word-break: break-all"
        >{{ displayContent || '(empty)' }}</pre
      >
      <p v-else class="m-0 text-small">Binary content — cannot display</p>
    </div>
  </AppModal>
</template>
