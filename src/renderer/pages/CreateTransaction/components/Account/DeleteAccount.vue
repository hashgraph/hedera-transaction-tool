<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountId, Hbar, AccountDeleteTransaction, Key } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const route = useRoute();
const toast = useToast();

const payerData = useAccountId();
const accountData = useAccountId();
const transferAccountData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountDeleteTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const selectedKey = ref<Key | null>();
const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    createTransaction();
    transaction.value?.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(
      accountData.keysFlattened.value,
      transferAccountData.accountInfo.value?.receiverSignatureRequired
        ? transferAccountData.keysFlattened.value
        : [],
    );
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = () => {
  const draft = getDraft<AccountDeleteTransaction>(route.query.draftId?.toString() || '');

  if (draft) {
    transaction.value = draft.transaction;

    if (draft.transaction.transactionId) {
      payerData.accountId.value =
        draft.transaction.transactionId.accountId?.toString() || payerData.accountId.value;
    }

    if (draft.transaction.maxTransactionFee) {
      maxTransactionFee.value = draft.transaction.maxTransactionFee.toBigNumber().toNumber();
    }

    accountData.accountId.value = draft.transaction.accountId?.toString() || '';
    transferAccountData.accountId.value = draft.transaction.transferAccountId?.toString() || '';
  }
};

/* Functions */
function createTransaction() {
  transaction.value = new AccountDeleteTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
    .setNodeAccountIds([new AccountId(3)]);

  if (accountData.accountId.value && isAccountId(accountData.accountId.value)) {
    transaction.value.setAccountId(accountData.accountId.value);
  }

  if (transferAccountData.accountId.value && isAccountId(transferAccountData.accountId.value)) {
    transaction.value.setTransferAccountId(transferAccountData.accountId.value);
  }

  return transaction.value.toBytes();
}

/* Hooks */
onMounted(() => {
  if (route.query.accountId) {
    accountData.accountId.value = route.query.accountId.toString();
  }

  handleLoadFromDraft();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="createTransaction"
      :create-requirements="
        !accountData.isValid.value ||
        !transferAccountData.isValid.value ||
        accountData.accountInfo.value?.deleted ||
        transferAccountData.accountInfo.value?.deleted
      "
      heading-text="Delete Account Transaction"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Account ID <span class="text-danger">*</span></label>
        <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Payer ID"
        />
      </div>

      <div class="form-group" :class="[columnClass]">
        <AppButton
          v-if="accountData.key.value"
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            selectedKey = accountData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="my-4">
      <p
        v-if="accountData.accountInfo.value && accountData.accountInfo.value.deleted"
        class="text-danger mt-4"
      >
        Account is already deleted!
      </p>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Transfer Account ID <span class="text-danger">*</span></label>
        <label v-if="transferAccountData.isValid.value" class="d-block form-label text-secondary"
          >Receive Signature Required:
          {{ transferAccountData.accountInfo.value?.receiverSignatureRequired || false }}</label
        >
        <AppInput
          :model-value="transferAccountData.accountIdFormatted.value"
          @update:model-value="v => (transferAccountData.accountId.value = v)"
          :disabled="transferAccountData.accountInfo.value?.deleted"
          :filled="true"
          placeholder="Enter Account ID"
        />
      </div>

      <div class="form-group" :class="[columnClass]">
        <AppButton
          v-if="transferAccountData.key.value"
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            selectedKey = transferAccountData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="my-4">
      <p
        v-if="
          transferAccountData.accountInfo.value && transferAccountData.accountInfo.value.deleted
        "
        class="text-danger mt-4"
      >
        Account is already deleted!
      </p>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="() => $router.push({ name: 'accounts' })"
  >
    <template #successHeading>Account deleted successfully</template>
    <template #successContent>
      <p
        v-if="transactionProcessor?.transactionResult"
        class="text-small d-flex justify-content-between align-items mt-2"
      >
        <span class="text-bold text-secondary">Account ID:</span>
        <span>{{ accountData.accountId.value }}</span>
      </p>
    </template>
  </TransactionProcessor>

  <KeyStructureModal
    v-if="accountData.isValid.value"
    v-model:show="isKeyStructureModalShown"
    :account-key="selectedKey"
  />
</template>
