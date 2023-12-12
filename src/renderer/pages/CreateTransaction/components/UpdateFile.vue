<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  AccountId,
  Client,
  FileUpdateTransaction,
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

const isFileUpdatedModalShown = ref(false);
const transactionId = ref('');
const fileId = ref('');

const payerId = ref('');
const validStart = ref('');
const signatureKeyText = ref('');
const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');
const isLoading = ref(false);

const signatureKeys = ref<string[]>([]);
const ownerKeys = ref<string[]>([]);

const transaction = ref<FileUpdateTransaction | null>(null);

const ownerKeyList = computed(
  () => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))),
);

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

// const handleFileImport = (e: Event) => {
//   const fileImportEl = e.target as HTMLInputElement;
//   const files = fileImportEl.files;

//   if (files && files.length > 0) {
//     const reader = new FileReader();
//     reader.onload = () => (content.value = reader.result?.toString() || '');
//     reader.readAsText(files[0]);
//   }
// };

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value) return;

  try {
    isLoading.value = true;

    const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];

    await Promise.all(
      keyPairsStore.keyPairs
        .filter(kp => signatureKeys.value.includes(kp.publicKey))
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

    isSignModalShown.value = false;

    transactionId.value = submitTx.transactionId.toString();

    isFileUpdatedModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const handleSign = async () => {
  const transactionId = TransactionId.withValidStart(
    AccountId.fromString(payerId.value),
    Timestamp.fromDate(validStart.value),
  );

  let fileUpdateTransaction = new FileUpdateTransaction()
    .setTransactionId(transactionId)
    .setTransactionValidDuration(180)
    .setNodeAccountIds([new AccountId(3)])
    .setFileId(fileId.value);

  if (ownerKeyList.value._keys.length > 0)
    fileUpdateTransaction = fileUpdateTransaction.setKeys(ownerKeyList.value);
  if (content.value) fileUpdateTransaction = fileUpdateTransaction.setContents(content.value);
  if (memo.value) fileUpdateTransaction = fileUpdateTransaction.setFileMemo(memo.value);
  if (expirationTimestamp.value)
    fileUpdateTransaction = fileUpdateTransaction.setExpirationTime(
      Timestamp.fromDate(expirationTimestamp.value),
    );

  transaction.value = fileUpdateTransaction.freezeWith(Client.forTestnet());

  isSignModalShown.value = true;
};

watch(isSignModalShown, () => (userPassword.value = ''));
watch(isFileUpdatedModalShown, () => (userPassword.value = ''));
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
      <!-- <div class="mt-4 form-group w-50">
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
      </div> -->
      <!-- <div class="mt-4 form-group w-25">
        <label for="fileUpload" class="form-label">
          <span for="fileUpload" class="btn btn-primary">Upload File (.json, .txt)</span>
        </label>
        <input
          class="form-control form-control-sm"
          id="fileUpload"
          name="fileUpload"
          type="file"
          accept=".json,.txt"
          @change="handleFileImport"
        />
      </div> -->
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea v-model="content" class="form-control py-3" rows="10"></textarea>
      </div>

      <div class="mt-4">
        <!-- <AppButton size="small" color="secondary" class="me-3 px-4 rounded-4">Save Draft</AppButton> -->
        <AppButton
          size="large"
          color="primary"
          :disabled="!fileId || !payerId || !validStart || signatureKeys.length === 0"
          @click="handleSign"
          >Sign</AppButton
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
        <AppButton
          color="primary"
          size="large"
          :loading="isLoading"
          :disabled="userPassword.length === 0"
          class="mt-5 w-100 rounded-4"
          @click="handleGetUserSignature"
          >Sign</AppButton
        >
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
            class="link-primary"
            :href="`https://hashscan.io/testnet/transaction/${transactionId}`"
            target="_blank"
            >{{ transactionId }}</a
          >
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
