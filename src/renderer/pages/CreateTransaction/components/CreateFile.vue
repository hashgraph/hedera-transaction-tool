<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  AccountId,
  Client,
  FileCreateTransaction,
  KeyList,
  PrivateKey,
  PublicKey,
  Timestamp,
  TransactionId,
} from '@hashgraph/sdk';

import { decryptPrivateKey } from '../../../services/keyPairService';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';
import useUserStateStore from '../../../stores/storeUserState';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();

const isSignModalShown = ref(false);
const userPassword = ref('');

const isFileCreatedModalShown = ref(false);
const transactionId = ref('');
const fileId = ref('');

const payerId = ref('');
const validStart = ref('');
const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');

const ownerKeys = ref<string[]>([]);

const transaction = ref<FileCreateTransaction | null>(null);

const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

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
};

const handleFileImport = (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const files = fileImportEl.files;

  if (files && files.length > 0) {
    const reader = new FileReader();
    reader.onload = () => (content.value = reader.result?.toString() || '');
    reader.readAsText(files[0]);
  }
};

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value) return;

  const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];

  await Promise.all(
    keyPairsStore.keyPairs
      .filter(kp => ownerKeys.value.includes(kp.publicKey))
      .map(async keyPair => {
        const privateKeyString = await decryptPrivateKey(
          userStateStore.userData!.userId,
          userPassword.value,
          keyPair.publicKey,
        );

        if (transaction.value) {
          const privateKey = PrivateKey.fromStringED25519(privateKeyString);
          const signature = privateKey.signTransaction(transaction.value as any);
          signatures.push({ publicKey: PublicKey.fromString(keyPair.publicKey), signature });
        }
      }),
  );

  signatures.forEach(s =>
    transaction.value
      ? (transaction.value = transaction.value.addSignature(s.publicKey, s.signature))
      : '',
  );

  const client = Client.forTestnet();

  const submitTx = await transaction.value?.execute(client);

  const receipt = await submitTx.getReceipt(client);

  isSignModalShown.value = false;

  transactionId.value = submitTx.transactionId.toString();
  fileId.value = receipt.fileId?.toString() || '';

  isFileCreatedModalShown.value = true;

  // Send to Transaction w/ user signatures to Back End
};

const handleSign = async () => {
  const transactionId = TransactionId.withValidStart(
    AccountId.fromString(payerId.value),
    Timestamp.fromDate(validStart.value),
  );

  let fileCreateTransaction = new FileCreateTransaction()
    .setTransactionId(transactionId)
    .setTransactionValidDuration(180)
    .setNodeAccountIds([new AccountId(3)])
    .setKeys(keyList.value);

  if (content.value) fileCreateTransaction = fileCreateTransaction.setContents(content.value);
  if (memo.value) fileCreateTransaction = fileCreateTransaction.setFileMemo(memo.value);
  if (expirationTimestamp.value)
    fileCreateTransaction = fileCreateTransaction.setExpirationTime(
      Timestamp.fromDate(expirationTimestamp.value),
    );

  transaction.value = fileCreateTransaction.freezeWith(Client.forTestnet());

  const userIncludedPublicKeys = keyPairsStore.keyPairs.filter(kp =>
    ownerKeys.value.includes(kp.publicKey),
  );

  if (userIncludedPublicKeys.length > 0) {
    isSignModalShown.value = true;
  } else {
    // Send to Back End
  }
};

watch(isSignModalShown, () => (userPassword.value = ''));
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
        <AppButton
          size="small"
          color="primary"
          class="px-4 rounded-4"
          :disabled="keyList._keys.length === 0 || !payerId || !validStart"
          @click="handleSign"
          >Sign</AppButton
        >
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Payer ID (Required)</label>
        <input
          v-model="payerId"
          type="text"
          class="form-control py-3"
          placeholder="Enter Payer ID"
        />
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label">Set Valid Start Time (Required)</label>
        <input v-model="validStart" type="datetime-local" class="form-control py-3" />
      </div>
      <div class="form-group w-75">
        <label class="form-label">Set Keys (Required)</label>
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
          type="datetime-local"
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
        <textarea v-model="content" class="form-control py-3" rows="10"></textarea>
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
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="handleGetUserSignature"
          >Sign</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isFileCreatedModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isFileCreatedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">File created successfully</h3>
        <p class="mt-4 text-small text-muted">Transaction ID: {{ transactionId }}</p>
        <p class="mt-2 text-small text-muted">File ID: {{ fileId }}</p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="
            isSignModalShown = false;
            transactionId = '';
            fileId = '';
          "
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
