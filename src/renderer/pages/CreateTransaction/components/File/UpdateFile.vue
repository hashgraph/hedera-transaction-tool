<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';

import {
  AccountId,
  FileAppendTransaction,
  FileUpdateTransaction,
  KeyList,
  PublicKey,
  Timestamp,
} from '@hashgraph/sdk';

import { openExternal } from '../../../../services/electronUtilsService';
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
const transactionIds = ref<string[]>([]);
const fileId = ref('');

const validStart = ref('');
const maxTransactionFee = ref(2);

const signatureKeyText = ref('');
const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const chunkSizeRaw = ref(2048);
const chunkData = ref<{ processed: number; total: number } | null>(null);
const isLoading = ref(false);

const signatureKeys = ref<string[]>([]);
const ownerKeys = ref<string[]>([]);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');

const transaction = ref<FileUpdateTransaction | null>(null);

const ownerKeyList = computed(
  () => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))),
);

const chunkSize = computed(() => {
  if (chunkSizeRaw.value > 6144) {
    return 6144;
  } else if (chunkSizeRaw.value < 1024) {
    return 1024;
  } else {
    return chunkSizeRaw.value;
  }
});

const handleOwnerKeyTextKeyPress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') handleAddOwnerKey();
};

const handleAddOwnerKey = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  ownerKeyText.value = '';
};

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
    fileReader.value.addEventListener('error', () => console.log('Error'));
    fileReader.value.addEventListener('abort', () => console.log('Aborted'));
  }
};

const handleGetUserSignature = async () => {
  try {
    isLoading.value = true;

    if (!userStateStore.userData?.userId) {
      throw Error('No user selected');
    }

    if (!transaction.value || !payerData.isValid.value) {
      return console.log('Transaction or payer missing');
    }

    const { updateTransaction, restChunks } = createTransaction(true);

    const originalTransactionSize = transaction.value.toBytes().length;

    if (originalTransactionSize >= 6144) {
      transaction.value = updateTransaction;
      chunkData.value = {
        processed: 0,
        total: restChunks.length,
      };
    }

    await getTransactionSignatures(
      keyPairsStore.keyPairs.filter(kp =>
        signatureKeys.value
          .concat(payerData.keysFlattened.value)
          .concat(ownerKeys.value)
          .includes(kp.publicKey),
      ),
      transaction.value as any,
      true,
      userStateStore.userData.userId,
      userPassword.value,
    );

    // Send to Transaction w/ user signatures to Back End
    const { transactionId: txId } = await execute(
      transaction.value.toBytes().toString(),
      networkStore.network,
      networkStore.customNetworkSettings,
    );
    transactionIds.value.push(txId);

    if (originalTransactionSize >= 6144) {
      for (const i in restChunks) {
        if (!isSignModalShown.value) {
          return;
        }

        const appendTx = await new FileAppendTransaction()
          .setTransactionId(createTransactionId(payerData.accountId.value, new Date()))
          .setTransactionValidDuration(180)
          .setNodeAccountIds([new AccountId(3)])
          .setFileId(fileId.value)
          .setContents(restChunks[i])
          .setMaxChunks(1)
          .setChunkSize(chunkSize.value)
          .freezeWith(networkStore.client);

        await getTransactionSignatures(
          keyPairsStore.keyPairs.filter(kp =>
            signatureKeys.value.concat(payerData.keysFlattened.value).includes(kp.publicKey),
          ),
          appendTx as any,
          true,
          userStateStore.userData.userId,
          userPassword.value,
        );

        const { transactionId: txId } = await execute(
          appendTx.toBytes().toString(),
          networkStore.network,
          networkStore.customNetworkSettings,
        );
        if (chunkData.value) {
          chunkData.value.processed = chunkData.value?.processed + 1;
        }
        transactionIds.value.push(txId);
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

    transaction.value = createTransaction().updateTransaction;

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

const createTransaction = (isLarge?: boolean) => {
  let updateTransaction = new FileUpdateTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setNodeAccountIds([new AccountId(3)])
    .setFileId(fileId.value)
    .setFileMemo(memo.value);

  ownerKeyList.value._keys.length > 0 && updateTransaction.setKeys(ownerKeyList.value);

  expirationTimestamp.value &&
    updateTransaction.setExpirationTime(Timestamp.fromDate(expirationTimestamp.value));

  if (content.value.length > 0) {
    console.log('s');

    updateTransaction.setContents(content.value);
  }
  if (fileBuffer.value) {
    updateTransaction.setContents(fileBuffer.value);
  }

  let chunks: Uint8Array[] = [];
  if (isLarge) {
    chunks = chunkBuffer(
      fileBuffer.value ? fileBuffer.value : new TextEncoder().encode(content.value),
      chunkSize.value,
    );

    updateTransaction.setContents(chunks[0]);
  }

  updateTransaction.freezeWith(networkStore.client);

  return { updateTransaction, restChunks: chunks.slice(1) };
};

function chunkBuffer(buffer: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

watch(isSignModalShown, shown => {
  userPassword.value = '';

  if (!shown) {
    fileMeta.value = null;
    fileBuffer.value = null;
    chunkData.value = null;
    content.value = '';
  }
});
watch(isFileUpdatedModalShown, () => (userPassword.value = ''));
watch(fileMeta, () => (content.value = ''));
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Update File Transaction</span>
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
      <div class="form-group w-75">
        <label class="form-label">Set Keys (Optional)</label>
        <div class="d-flex gap-3">
          <input
            v-model="ownerKeyText"
            type="text"
            class="form-control py-3"
            placeholder="Enter owner public key"
            style="max-width: 555px"
            @keypress="handleOwnerKeyTextKeyPress"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAddOwnerKey">Add</AppButton>
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
          type="datetime-local"
          class="form-control py-3"
          placeholder="Enter timestamp"
        />
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label">Set Chunk Size (If File is large)</label>
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
            (content.length > 0 && fileBuffer)
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
        <h3 class="mt-5 text-main text-center text-bold">File updated successfully</h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="
              networkStore.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${networkStore.network}/transaction/${transactionIds[0]}`)
            "
            >{{ transactionIds[0] }}</a
          >
        </p>
        <p v-if="chunkData" class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Number of Appends</span>
          <span>{{ chunkData?.total }}</span>
        </p>
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
