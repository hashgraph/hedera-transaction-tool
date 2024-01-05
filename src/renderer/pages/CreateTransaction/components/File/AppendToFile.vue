<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';

import { AccountId, FileAppendTransaction, PublicKey } from '@hashgraph/sdk';

import {
  createTransactionId,
  execute,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useUserStateStore from '../../../../stores/storeUserState';
import useNetworkStore from '../../../../stores/storeNetwork';

import useAccountId from '../../../../composables/useAccountId';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';

const toast = useToast();

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();

const payerData = useAccountId();

const isSignModalShown = ref(false);
const userPassword = ref('');

const isFileUpdatedModalShown = ref(false);
const fileId = ref('');

const validStart = ref('');
const maxTransactionFee = ref(2);

const signatureKeyText = ref('');
const chunks = ref<Uint8Array[]>([]);
const chunkSizeRaw = ref(2048);
const chunkData = ref<{ processed: number; total: number } | null>(null);
const isLoading = ref(false);

const signatureKeys = ref<string[]>([]);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');

const chunkSize = computed(() => {
  if (chunkSizeRaw.value > 6144) {
    return 6144;
  } else if (chunkSizeRaw.value < 1024) {
    return 1024;
  } else {
    return chunkSizeRaw.value;
  }
});

const handleSignatureKeyTextKeyPress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') handleAddSignatureKey();
};

const handleAddSignatureKey = () => {
  signatureKeys.value.push(signatureKeyText.value);
  signatureKeys.value = signatureKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  signatureKeyText.value = '';
};

const handleRemoveFile = async () => {
  fileReader.value?.abort();
  fileMeta.value = null;
  fileReader.value = null;
  fileBuffer.value = null;
  content.value = '';
};

const handleFileImport = async (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const file = fileImportEl.files && fileImportEl.files[0];

  if (file) {
    fileMeta.value = file;

    fileReader.value = new FileReader();

    fileReader.value.readAsArrayBuffer(file);
    fileReader.value.addEventListener('loadend', async () => {
      const data = fileReader.value?.result;
      if (data && data instanceof ArrayBuffer) {
        fileBuffer.value = new Uint8Array(data);
      }
    });
    fileReader.value.addEventListener(
      'progress',
      e => (loadPercentage.value = (100 * e.loaded) / e.total),
    );
    fileReader.value.addEventListener('error', () => toast.error('Failed to upload file'));
    fileReader.value.addEventListener('abort', () => toast.error('File upload aborted'));
  }
};

const handleGetUserSignature = async () => {
  try {
    isLoading.value = true;

    if (!userStateStore.userData?.userId) {
      throw Error('No user selected');
    }

    if (!payerData.isValid.value) {
      return console.log('Payer missing');
    }

    for (const i in chunks.value) {
      const appendTransaction = new FileAppendTransaction()
        .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
        .setTransactionValidDuration(180)
        .setNodeAccountIds([new AccountId(3)])
        .setFileId(fileId.value)
        .setMaxChunks(1)
        .setChunkSize(chunkSize.value)
        .setContents(chunks.value[i]);

      appendTransaction.freezeWith(networkStore.client);

      await getTransactionSignatures(
        keyPairsStore.keyPairs.filter(kp =>
          signatureKeys.value.concat(payerData.keysFlattened.value).includes(kp.publicKey),
        ),
        appendTransaction as any,
        true,
        userStateStore.userData.userId,
        userPassword.value,
      );

      // Send to Transaction w/ user signatures to Back End
      await execute(
        appendTransaction.toBytes().toString(),
        networkStore.network,
        networkStore.customNetworkSettings,
      );

      if (chunkData.value) {
        chunkData.value.processed = chunkData.value?.processed + 1;
      }
    }

    isSignModalShown.value = false;
    isFileUpdatedModalShown.value = true;
  } catch (err: any) {
    let message = 'Transaction failed';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  try {
    isLoading.value = true;

    chunks.value = chunkBuffer(
      fileBuffer.value ? fileBuffer.value : new TextEncoder().encode(content.value),
      chunkSize.value,
    );

    chunkData.value = {
      processed: 0,
      total: chunks.value.length,
    };
    //Check owner

    isSignModalShown.value = true;
  } catch (err: any) {
    let message = 'Failed to create transaction';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  } finally {
    isLoading.value = false;
  }
};

function chunkBuffer(buffer: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

watch(isSignModalShown, () => (userPassword.value = ''));
watch(isFileUpdatedModalShown, () => (userPassword.value = ''));
watch(fileMeta, () => (content.value = ''));
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Append To File Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionFee" type="number" min="0" class="form-control" />
        </div>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set File ID</label>
        <input v-model="fileId" type="text" class="form-control py-3" placeholder="Enter File ID" />
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Signature Keys (Required)</label>
        <div class="d-flex gap-3">
          <input
            v-model="signatureKeyText"
            type="text"
            class="form-control py-3"
            placeholder="Enter signer public key"
            style="max-width: 555px"
            @keypress="handleSignatureKeyTextKeyPress"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAddSignatureKey"
            >Add</AppButton
          >
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in signatureKeys" :key="key">
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
              @click="signatureKeys = signatureKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label">Set Chunk Size</label>
        <input
          v-model="chunkSizeRaw"
          type="number"
          min="1024"
          max="4096"
          class="form-control py-3"
        />
      </div>
      <div class="mt-4 form-group">
        <label for="fileUpload" class="form-label">
          <span for="fileUpload" class="btn btn-primary" :class="{ disabled: content.length > 0 }"
            >Upload File</span
          >
        </label>
        <input
          class="form-control form-control-sm"
          id="fileUpload"
          name="fileUpload"
          type="file"
          :disabled="content.length > 0"
          @change="handleFileImport"
        />
        <template v-if="fileMeta">
          <span v-if="fileMeta" class="ms-3">{{ fileMeta.name }}</span>
          <span v-if="loadPercentage < 100" class="ms-3">{{ loadPercentage.toFixed(2) }}%</span>
          <span v-if="fileMeta" class="ms-3 cursor-pointer" @click="handleRemoveFile"
            ><i class="bi bi-x-lg"></i
          ></span>
        </template>
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea
          v-model="content"
          :disabled="Boolean(fileBuffer)"
          class="form-control py-3"
          rows="10"
        ></textarea>
      </div>

      <div class="mt-4">
        <!-- <AppButton size="small" color="secondary" class="me-3 px-4 rounded-4">Save Draft</AppButton> -->
        <AppButton
          size="large"
          color="primary"
          :disabled="
            !fileId ||
            !payerData.isValid.value ||
            signatureKeys.length === 0 ||
            (!content && !fileBuffer)
          "
          @click="handleCreate"
          >Create</AppButton
        >
      </div>
    </div>
    <AppModal v-model:show="isSignModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSignModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-shield-lock extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>

        <div class="mt-4 form-group">
          <input v-model="userPassword" type="password" class="form-control rounded-4" />
        </div>
        <div class="mt-4">
          <div class="ms-2" v-if="chunkData">
            {{ chunkData.processed }} appends out of {{ chunkData.total }}
          </div>
          <AppButton
            color="primary"
            size="large"
            :loading="isLoading"
            :disabled="userPassword.length === 0 || isLoading"
            class="mt-2 w-100 rounded-4"
            @click="handleGetUserSignature"
            >Sign</AppButton
          >
        </div>
      </div>
    </AppModal>
    <AppModal v-model:show="isFileUpdatedModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isFileUpdatedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Appended to file successfully</h3>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">File ID:</span> <span>{{ fileId }}</span>
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isFileUpdatedModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
