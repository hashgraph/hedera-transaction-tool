<script setup lang="ts">
import { computed, ref } from 'vue';

import AppButton from '../../../components/ui/AppButton.vue';
import { PublicKey } from '@hashgraph/sdk';

const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const importedFile = ref('');
const ownerKeys = ref<string[]>([]);

const ownerPublicKeys = computed(() => ownerKeys.value.map(key => PublicKey.fromString(key)));

const handleOwnerKeyTextKeyPress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') handleAdd();
};

const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  ownerKeyText.value = '';

  console.log(ownerPublicKeys.value);
};

const handleFileImport = (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const files = fileImportEl.files;

  if (files && files.length > 0) {
    const reader = new FileReader();
    reader.onload = () => (importedFile.value = reader.result?.toString() || '');
    reader.readAsText(files[0]);
  }
};

const handleSign = () => {
  //Collect siganture
};
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Create File Transaction</span>
      </div>
      <div>
        <AppButton size="small" color="secondary" class="me-3 px-4 rounded-4">Save Draft</AppButton>
        <AppButton size="small" color="primary" class="px-4 rounded-4" @click="handleSign"
          >Sign</AppButton
        >
      </div>
    </div>
    <div class="mt-4">
      <div class="form-group w-75">
        <label class="form-label">Set Keys</label>
        <div class="d-flex gap-3">
          <input
            v-model="ownerKeyText"
            type="text"
            class="form-control py-3"
            placeholder="Enter owner public key"
            style="max-width: 555px"
            @keypress="handleOwnerKeyTextKeyPress"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAdd">Add</AppButton>
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in ownerKeys" :key="key">
          <div class="d-flex align-items-center gap-3">
            <input
              type="text"
              readonly
              class="form-control py-3"
              :value="key"
              style="max-width: 555px"
            />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              style="line-height: 16px"
              @click="ownerKeys = ownerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set File Memo (Optional)</label>
        <input
          v-model="memo"
          type="text"
          class="form-control py-3"
          maxlength="100"
          placeholder="Enter memo"
        />
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label">Set Expiration Time (Optional)</label>
        <input
          v-model="expirationTimestamp"
          type="number"
          class="form-control py-3"
          placeholder="Enter timestamp"
        />
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label" for="forFile">Upload File (.json, .txt)</label>
        <input
          class="form-control form-control-sm"
          name="forFile"
          type="file"
          accept=".json,.txt"
          @change="handleFileImport"
        />
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea v-model="importedFile" class="form-control py-3" rows="10"></textarea>
      </div>
    </div>
  </div>
</template>
