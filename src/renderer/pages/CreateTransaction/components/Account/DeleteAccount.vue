<script setup lang="ts">
import { ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';

import { AccountId, KeyList, PublicKey, Hbar, AccountDeleteTransaction } from '@hashgraph/sdk';

import { openExternal } from '../../../../services/electronUtilsService';
import {
  createTransactionId,
  execute,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import useAccountId from '../../../../composables/useAccountId';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useNetworkStore from '../../../../stores/storeNetwork';
import useUserStateStore from '../../../../stores/storeUserState';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const toast = useToast();

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();

const payerData = useAccountId();
const accountData = useAccountId();
const transferAccountData = useAccountId();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAccountDeleteModalShown = ref(false);
const transactionId = ref('');

const validStart = ref('');
const maxTransactionfee = ref(2);

const transaction = ref<AccountDeleteTransaction | null>(null);
const isLoading = ref(false);

const handleGetUserSignature = async () => {
  try {
    if (!userStateStore.userData?.userId) {
      throw new Error('No user selected');
    }

    if (!transaction.value || !payerData.accountId.value) {
      throw new Error('Transaction or payer missing');
    }

    isLoading.value = true;

    await getTransactionSignatures(
      keyPairsStore.keyPairs.filter(kp =>
        payerData.keysFlattened.value
          .concat(
            accountData.keysFlattened.value,
            transferAccountData.accountInfo.value?.receiverSignatureRequired
              ? transferAccountData.keysFlattened.value
              : [],
          )
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
    transactionId.value = txId;

    isSignModalShown.value = false;
    isAccountDeleteModalShown.value = true;
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

    transaction.value = new AccountDeleteTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId.value)
      .setTransferAccountId(transferAccountData.accountId.value);

    transaction.value.freezeWith(networkStore.client);

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      payerData.keysFlattened.value
        .concat(
          accountData.keysFlattened.value,
          transferAccountData.accountInfo.value?.receiverSignatureRequired
            ? transferAccountData.keysFlattened.value
            : [],
        )
        .includes(kp.publicKey),
    );

    if (someUserAccountIsPayer) {
      isSignModalShown.value = true;
    } else {
      // Send to Back End (Payer, old key, new key should sign!)
      console.log('Account create sent to Back End for payer signature');
    }
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

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountDeleteModalShown, shown => {
  if (!shown) {
    payerData.accountId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    accountData.accountId.value = '';
    transferAccountData.accountId.value = '';

    transactionId.value = '';
    transaction.value = null;
  }
});
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
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control" />
        </div>
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Account ID (Required)</label>
        <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="accountData.accountIdFormatted.value"
          @input="accountData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="mt-4" v-if="accountData.key.value">
        <AppButton color="secondary" size="small" @click="isKeyStructureModalShown = true"
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Transfer Account ID (Required)</label>
        <label v-if="transferAccountData.isValid.value" class="d-block form-label text-secondary"
          >Receive Signature Required:
          {{ transferAccountData.accountInfo.value?.receiverSignatureRequired || false }}</label
        >
        <input
          :value="transferAccountData.accountIdFormatted.value"
          @input="transferAccountData.accountId.value = ($event.target as HTMLInputElement).value"
          :disabled="accountData.accountInfo.value?.deleted"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <p
        v-if="accountData.accountInfo.value && accountData.accountInfo.value.deleted"
        class="text-danger mt-4"
      >
        Account is already deleted!
      </p>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="
            !accountData.isValid.value ||
            !transferAccountData.isValid.value ||
            accountData.accountInfo.value?.deleted
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
          :disabled="userPassword.length === 0 || isLoading"
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
            @click="
              networkStore.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${networkStore.network}/transaction/${transactionId}`)
            "
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{ accountData.accountId.value }}</span>
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
          v-if="accountData.key.value instanceof KeyList && true"
          :key-list="accountData.key.value"
        />
        <div v-else-if="accountData.key.value instanceof PublicKey && true">
          {{ accountData.key.value.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
