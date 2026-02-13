<script setup lang="ts">
import { ref } from 'vue';

import { useToast } from 'vue-toast-notification';

import AppInput from '@renderer/components/ui/AppInput.vue';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  id: string;
  file: { meta: File; content: Uint8Array; loadPercentage: number } | null;
  maxSizeKb: number;
  showName?: boolean;
  showProgress?: boolean;
  accept?: string;
  disabled?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (
    event: 'update:file',
    file: { meta: File; content: Uint8Array; loadPercentage: number } | null,
  ): void;
  (event: 'load:start'): void;
  (event: 'load:end'): void;
}>();

/* Composables */
const toast = useToast();

/* State */
const fileReader = ref<FileReader | null>(null);

/* Handlers */
const handleFileImport = async (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const file = fileImportEl.files && fileImportEl.files[0];

  if (file) {
    if (file.size > (props.maxSizeKb || 0) * 1024) {
      toast.error(`File size exceeds ${props.maxSizeKb} KB`, errorToastOptions);
      return;
    }

    emit('update:file', { meta: file, content: new Uint8Array(), loadPercentage: 0 });
    emit('load:start');

    fileReader.value = new FileReader();
    fileReader.value.readAsArrayBuffer(file);

    fileReader.value.addEventListener('loadend', async () => {
      const data = fileReader.value?.result;
      if (data && data instanceof ArrayBuffer) {
        emit('update:file', { meta: file, content: new Uint8Array(data), loadPercentage: 100 });
      }
      emit('load:end');
    });

    fileReader.value.addEventListener('progress', e =>
      emit('update:file', {
        meta: file,
        content: new Uint8Array(),
        loadPercentage: (100 * e.loaded) / e.total,
      }),
    );

    fileReader.value.addEventListener('error', () => {
      emit('update:file', null);
      toast.error('Failed to upload file', errorToastOptions);
    });
    fileReader.value.addEventListener('abort', () => {
      emit('update:file', null);
      toast.error('File upload aborted', errorToastOptions);
    });
  }
};

const handleRemoveFile = async () => {
  emit('update:file', null);
  fileReader.value?.abort();
};
</script>
<template>
  <div>
    <label :for="id" class="form-label">
      <span :for="id" class="btn btn-primary" :class="{ disabled }">Upload File</span>
    </label>
    <AppInput
      :id="id"
      size="small"
      type="file"
      :accept="accept"
      :disabled="disabled"
      @change="handleFileImport"
    />
    <template v-if="file">
      <span v-if="showName" class="ms-3">{{ file.meta.name }}</span>
      <span v-if="showProgress && file.loadPercentage < 100" class="ms-3"
        >{{ file.loadPercentage.toFixed(2) }}%</span
      >
      <span class="ms-3 cursor-pointer" @click="handleRemoveFile"><i class="bi bi-x-lg"></i></span>
    </template>
  </div>
</template>
