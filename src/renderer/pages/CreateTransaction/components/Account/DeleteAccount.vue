<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

import {
  AccountId,
  Client,
  KeyList,
  PrivateKey,
  PublicKey,
  Hbar,
  Key,
  AccountDeleteTransaction,
} from '@hashgraph/sdk';

import { decryptPrivateKey, flattenKeyList } from '../../../../services/keyPairService';
import { openExternal } from '../../../../services/electronUtilsService';
import { getAccountInfo } from '../../../../services/mirrorNodeDataService';
import { createTransactionId } from '../../../../services/transactionService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useMirrorNodeLinksStore from '../../../../stores/storeMirrorNodeLinks';
import useUserStateStore from '../../../../stores/storeUserState';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const mirrorLinksStore = useMirrorNodeLinksStore();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAccountDeleteModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const validStart = ref('');
const maxTransactionfee = ref(2);

const accountData = reactive<{
  accountId: string;
  key: Key | null;
  transferAccountId: string;
  deleted: boolean;
}>({
  accountId: '',
  transferAccountId: '',
  deleted: false,
  key: null,
});

const transaction = ref<AccountDeleteTransaction | null>(null);
const isLoading = ref(false);

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value || !payerId.value) {
    return console.log('Transaction or payer missing');
  }

  try {
    isLoading.value = true;

    const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];

    let accountKeysFlattened: string[] = [];
    if (accountData.key) {
      accountKeysFlattened = flattenKeyList(accountData.key).map(pk => pk.toStringRaw());
    }

    await Promise.all(
      keyPairsStore.keyPairs
        .filter(kp => payerId.value === kp.accountId || accountKeysFlattened.includes(kp.publicKey))
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

    signatures.forEach(s => transaction.value?.addSignature(s.publicKey, s.signature));

    const client = Client.forTestnet();

    const submitTx = await transaction.value?.execute(client);

    await submitTx.getReceipt(client);

    isSignModalShown.value = false;

    transactionId.value = submitTx.transactionId.toString();

    isAccountDeleteModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  try {
    isLoading.value = true;

    let accountDeleteTransaction = new AccountDeleteTransaction()
      .setTransactionId(createTransactionId(payerId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId)
      .setTransferAccountId(accountData.transferAccountId);

    transaction.value = accountDeleteTransaction.freezeWith(Client.forTestnet());

    let keys = accountData.key ? flattenKeyList(accountData.key).map(pk => pk.toStringRaw()) : [];

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(
      kp => payerId.value === kp.accountId || keys.includes(kp.publicKey),
    );

    if (someUserAccountIsPayer) {
      isSignModalShown.value = true;
    } else {
      // Send to Back End (Payer, old key, new key should sign!)
      console.log('Account create sent to Back End for payer signature');
    }
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
  }
};

const handleResetAccoundData = () => {
  accountData.transferAccountId = '';
  accountData.deleted = false;
  accountData.key = null;
};

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountDeleteModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    accountData.accountId = '';
    handleResetAccoundData();

    transactionId.value = '';
    transaction.value = null;
  }
});
watch(
  () => accountData.accountId,
  async newAccountId => {
    if (!newAccountId) return;

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      if (accountInfo) {
        accountData.accountId = accountInfo.accountId.toString();
        accountData.deleted = accountInfo.deleted;
        accountData.key = accountInfo.key;
      }
    } catch (e) {
      handleResetAccoundData();
    }
  },
);
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Delete Account Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <input v-model="payerId" type="text" class="form-control" placeholder="Enter Payer ID" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control" />
        </div>
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Account ID (Required)</label>
        <input
          v-model="accountData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="mt-4" v-if="accountData.key">
        <AppButton color="secondary" size="small" @click="isKeyStructureModalShown = true"
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Transfer Account ID (Required)</label>
        <input
          v-model="accountData.transferAccountId"
          :disabled="accountData.deleted"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <p v-if="accountData.deleted" class="text-danger mt-4">Account is already deleted!</p>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="
            !accountData.accountId || !accountData.transferAccountId || accountData.deleted
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
    <AppModal v-model:show="isAccountDeleteModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isAccountDeleteModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Account deleted successfully</h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="openExternal(`https://hashscan.io/testnet/transaction/${transactionId}`)"
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{ accountData.accountId }}</span>
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isAccountDeleteModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isKeyStructureModalShown" class="modal-fit-content">
      <div class="p-5">
        <KeyStructure
          v-if="accountData.key instanceof KeyList && true"
          :key-list="accountData.key"
        />
        <div v-else-if="accountData.key instanceof PublicKey && true">
          {{ accountData.key.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
