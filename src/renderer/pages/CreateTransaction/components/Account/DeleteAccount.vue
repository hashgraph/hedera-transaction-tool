<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountId, KeyList, PublicKey, Hbar, AccountDeleteTransaction } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

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
const validStart = ref('');
const maxTransactionfee = ref(2);

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
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Delete Account Transaction</span>
      </div>
    </div>
    <form class="mt-4" @submit="handleCreate">
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
            class="form-control is-fill"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control is-fill" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control is-fill" />
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
          class="form-control is-fill"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="mt-4" v-if="accountData.key.value">
        <AppButton
          color="secondary"
          type="button"
          size="small"
          @click="isKeyStructureModalShown = true"
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
          class="form-control is-fill"
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
          type="submit"
          size="large"
          :disabled="
            !accountData.isValid.value ||
            !transferAccountData.isValid.value ||
            accountData.accountInfo.value?.deleted
          "
          >Create</AppButton
        >
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
