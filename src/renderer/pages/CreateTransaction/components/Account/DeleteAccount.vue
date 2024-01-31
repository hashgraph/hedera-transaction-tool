<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountId, Hbar, AccountDeleteTransaction, Key } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import { getDateTimeLocalInputValue } from '../../../../utils';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import KeyStructureModal from '../../../../components/KeyStructureModal.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '../../../../components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '../../../../components/Transaction/TransactionIdControls.vue';

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
const maxTransactionfee = ref(2);

const selectedKey = ref<Key | null>();
const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    transaction.value = new AccountDeleteTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId.value)
      .setTransferAccountId(transferAccountData.accountId.value);

    transaction.value.freezeWith(networkStore.client);

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

/* Hooks */
onMounted(() => {
  if (route.query.accountId) {
    accountData.accountId.value = route.query.accountId.toString();
  }
});

/* Misc */
const columnClass = 'col-8 col-md-6 col-xxl-4';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
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
      v-model:max-transaction-fee="maxTransactionfee"
      class="mt-6"
    />

    <hr class="separator my-6" />

    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Account ID <span class="text-danger">*</span></label>
      <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
        >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
      >
      <div class="row align-items-center">
        <div class="col-8">
          <AppInput
            :model-value="accountData.accountIdFormatted.value"
            @update:model-value="v => (accountData.accountId.value = v)"
            :filled="true"
            placeholder="Enter Account ID"
          />
        </div>
        <div class="col-4">
          <AppButton
            v-if="accountData.key.value"
            color="secondary"
            type="button"
            @click="
              isKeyStructureModalShown = true;
              selectedKey = accountData.key.value;
            "
            >Show Key</AppButton
          >
        </div>
      </div>
      <p
        v-if="accountData.accountInfo.value && accountData.accountInfo.value.deleted"
        class="text-danger mt-4"
      >
        Account is already deleted!
      </p>
    </div>

    <div class="form-group mt-6" :class="[columnClass]">
      <label class="form-label">Transfer Account ID <span class="text-danger">*</span></label>
      <label v-if="transferAccountData.isValid.value" class="d-block form-label text-secondary"
        >Receive Signature Required:
        {{ transferAccountData.accountInfo.value?.receiverSignatureRequired || false }}</label
      >
      <div class="row align-items-center">
        <div class="col-8">
          <AppInput
            :model-value="transferAccountData.accountIdFormatted.value"
            @update:model-value="v => (transferAccountData.accountId.value = v)"
            :disabled="transferAccountData.accountInfo.value?.deleted"
            :filled="true"
            placeholder="Enter Account ID"
          />
        </div>
        <div class="col-4">
          <AppButton
            v-if="transferAccountData.key.value"
            color="secondary"
            type="button"
            @click="
              isKeyStructureModalShown = true;
              selectedKey = transferAccountData.key.value;
            "
            >Show Key</AppButton
          >
        </div>
      </div>
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
