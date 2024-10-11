<script setup lang="ts">
import type { Key } from '@hashgraph/sdk';
import { DISPLAY_FILE_SIZE_LIMIT } from '@main/shared/constants';
import type { FileUpdateData } from '@renderer/utils/sdk';

import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import {
  getMinimumExpirationTime,
  getMaximumExpirationTime,
  isHederaSpecialFileId,
  isLoggedInOrganization,
  safeAwait,
  formatAccountId,
} from '@renderer/utils';

import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import KeyField from '@renderer/components/KeyField.vue';
import AppDatePicker from '@renderer/components/Wrapped/AppDatePicker.vue';

/* Props */
const props = defineProps<{
  data: FileUpdateData;
  signatureKey: Key | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: FileUpdateData): void;
  (event: 'update:signatureKey', key: Key | null): void;
}>();

/* Stores */
const user = useUserStore();

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

async function syncDisplayedContent() {
  if (file.value === null) {
    displayedFileText.value = null;
    return;
  }

  if (file.value && file.value.meta.size > DISPLAY_FILE_SIZE_LIMIT) {
    displayedFileText.value = '';
    return;
  }

  if (isHederaSpecialFileId(props.data.fileId)) {
    const { data, error } = await safeAwait(
      window.electronAPI.local.files.decodeProto(props.data.fileId, file.value.content),
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
watch(manualContent, newContent => {
  if (newContent.length > 0) {
    removeContent.value = false;
  }
});
watch(file, newFile => {
  if (newFile && newFile.content.length > 0) {
    removeContent.value = false;
  }
});
watch(file, () => (manualContent.value = ''));
watch(
  () => props.data.fileId,
  async id => {
    if (isHederaSpecialFileId(id) && !file.value?.meta.name.endsWith('.bin')) {
      file.value = null;
      manualContent.value = '';
    }
    await syncDisplayedContent();
  },
);
watch([file, manualContent], () => {
  emit('update:data', {
    ...props.data,
    contents: manualContent.value.length > 0 ? manualContent.value : file.value?.content || null,
  });
});

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
            fileId: formatAccountId($event),
          })
        "
        :filled="true"
        placeholder="Enter File ID"
        data-testid="input-file-id-for-update"
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
    <div class="form-group col-8 col-xxxl-6">
      <KeyField
        :model-key="data.ownerKey"
        @update:model-key="
          $emit('update:data', {
            ...data,
            ownerKey: $event,
          })
        "
        label="New Key"
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

  <!-- <div class="row mt-6"> TODO
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Chunk Size (If File is large)</label>
            <AppInput
              v-model="chunkSize"
              type="number"
              min="1024"
              max="6144"
              :filled="true"
              placeholder="Enter Chunk Size"
            />
          </div>
        </div> -->

  <div class="mt-6 form-group">
    <AppUploadFile
      id="update-transaction-file"
      show-name
      show-progress
      v-model:file="file"
      :accept="isHederaSpecialFileId(data.fileId) ? '.bin' : '*'"
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

      <Transition name="fade" mode="out-in">
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
</template>
