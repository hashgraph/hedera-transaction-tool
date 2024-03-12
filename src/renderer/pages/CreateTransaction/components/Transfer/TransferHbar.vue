<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Hbar, KeyList, Transaction, TransferTransaction, Transfer } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft, updateDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isAccountId } from '@renderer/utils/validator';

import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransferCard from '@renderer/components/TransferCard.vue';

/* Interfaces */

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const transfers = ref<Transfer[]>([]);

const isExecuted = ref(false);

/* Computed */
const totalBalance = computed(() => {
  const totalBalance = transfers.value.reduce(
    (acc, debit) => acc.plus(debit.amount.toBigNumber()),
    new Hbar(0).toBigNumber(),
  );
  return new Hbar(totalBalance);
});

const totalBalanceAdjustments = computed(
  () => [...new Set(transfers.value.map(t => t.accountId.toString()))].length,
);

const balanceAdjustmentsPerAccount = computed(() => {
  return transfers.value.reduce((acc, transfer) => {
    const accountId = transfer.accountId.toString();
    const amount = transfer.amount.toBigNumber();

    if (acc[accountId]) {
      acc[accountId] = acc[accountId].plus(amount);
    } else {
      acc[accountId] = amount;
    }

    return acc;
  }, {});
});

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();
  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    transaction.value = createTransaction();

    const requiredKey = new KeyList([payerData.key.value]);

    await transactionProcessor.value?.process(requiredKey);
  } catch (err: any) {
    console.log(err);

    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleDraftAdded = async (id: string) => {
  await updateDraft(id, { details: JSON.stringify({ transfers: transfers.value }) });
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<TransferTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.transactionId) {
      const transactionId = draftTransaction.transactionId;

      if (transactionId.accountId) {
        payerData.accountId.value = transactionId.accountId.toString();
      }
    }

    if (draftTransaction.maxTransactionFee) {
      maxTransactionFee.value = draftTransaction.maxTransactionFee.toBigNumber().toNumber();
    }

    if (draft.details) {
      try {
        const details = JSON.parse(draft.details);
        transfers.value = details.transfers.map(
          ({
            accountId,
            amount,
            isApproved,
          }: {
            accountId: string;
            amount: string;
            isApproved: boolean;
          }) => new Transfer({ accountId, amount: Hbar.fromTinybars(amount), isApproved }),
        );
      } catch {
        /* Empty */
      }
    }
  }
};

const handleAddSenderTransfer = (accountId: string, amount: Hbar, isApproved: boolean) => {
  const debittedAccounts = transfers.value.filter(
    debit => debit.accountId.toString() === accountId && debit.amount.isNegative(),
  );

  if (
    debittedAccounts.every(account => isApproved && !account.isApproved) ||
    debittedAccounts.every(account => !isApproved && account.isApproved)
  ) {
    transfers.value.push(
      new Transfer({
        accountId,
        amount: amount.negated(),
        isApproved,
      }),
    );
  } else {
    debittedAccounts.forEach(account => {
      const updatedAmount = new Hbar(
        account.amount.toBigNumber().plus(amount.negated().toBigNumber()),
      );

      if (account.isApproved && isApproved) {
        account.amount = updatedAmount;
      } else if (!isApproved && !account.isApproved) {
        account.amount = updatedAmount;
      }
    });
  }

  transfers.value = [...transfers.value];
};

const handleAddReceiverTransfer = (accountId: string, amount: Hbar) => {
  const creditted = transfers.value.find(
    credit => credit.accountId.toString() === accountId && !credit.amount.isNegative(),
  );

  if (!creditted) {
    transfers.value.push(
      new Transfer({
        accountId,
        amount: amount,
        isApproved: false,
      }),
    );
  } else {
    creditted.amount = new Hbar(creditted.amount.toBigNumber().plus(amount.toBigNumber()));
  }

  transfers.value = [...transfers.value];
};

/* Functions */
function createTransaction() {
  const transaction = new TransferTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value || 0));

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  transfers.value.forEach(transfer => {
    transfer.isApproved
      ? transaction.addApprovedHbarTransfer(transfer.accountId.toString(), transfer.amount)
      : transaction.addHbarTransfer(transfer.accountId.toString(), transfer.amount);
  });

  return transaction;
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :handle-draft-added="handleDraftAdded"
      :is-executed="isExecuted"
      :create-requirements="
        !payerData.accountId.value ||
        !totalBalance.toBigNumber().isEqualTo(0) ||
        totalBalanceAdjustments > 10
      "
      heading-text="Transfer Hbar Transaction"
      class="flex-1"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <div class="border rounded p-5 mt-5">
      <div class="flex-centered">
        <div class="flex-1">
          <TransferCard
            account-label="From"
            @handle-add-transfer="handleAddSenderTransfer"
            :show-approved="true"
            :show-balance="true"
            :spender="payerData.accountIdFormatted.value"
            :button-disabled="totalBalanceAdjustments >= 10"
          />
        </div>
        <div class="mx-6">
          <span class="bi bi-arrow-right"></span>
        </div>
        <div class="flex-1">
          <TransferCard
            account-label="To"
            @handle-add-transfer="handleAddReceiverTransfer"
            :button-disabled="totalBalanceAdjustments >= 10"
          />
        </div>
      </div>
      <div class="d-flex">
        <div class="flex-1">
          <div class="mt-3">
            <template v-for="(debit, i) in transfers" :key="debit.accountId">
              <div v-if="debit.amount.isNegative()" class="mt-3">
                <div class="d-flex justify-content-between align-items-center">
                  <p class="text-small text-secondary">
                    {{ debit.accountId }} {{ debit.isApproved ? '(Approved)' : '' }}
                  </p>
                  <div class="">
                    <span class="text-small text-secondary">{{ debit.amount }}</span>
                    <span
                      class="bi bi-x-lg text-small text-secondary cursor-pointer ms-3"
                      @click="() => transfers.splice(i, 1)"
                    ></span>
                  </div>
                </div>
                <hr class="separator" />
              </div>
            </template>
          </div>
        </div>
        <div class="mx-6"></div>
        <div class="flex-1">
          <div class="mt-3">
            <template v-for="(credit, i) in transfers" :key="credit.accountId">
              <div v-if="!credit.amount.isNegative()" class="mt-3">
                <div class="d-flex justify-content-between align-items-center">
                  <p class="text-small text-secondary">{{ credit.accountId }}</p>
                  <div class="">
                    <span class="text-small text-secondary">{{ credit.amount }}</span>
                    <span
                      class="bi bi-x-lg text-small text-secondary cursor-pointer ms-3"
                      @click="() => transfers.splice(i, 1)"
                    ></span>
                  </div>
                </div>
                <hr class="separator" />
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="d-flex justify-content-between mt-5">
        <p class="text-small">
          <span>{{ totalBalanceAdjustments }}</span>
          <span class="text-secondary"> Adjustments</span>
        </p>
        <p class="text-small">
          <span class="text-secondary">Balance</span> <span>{{ totalBalance }}</span>
        </p>
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="
      () => {
        validStart = '';
        maxTransactionFee = 2;
        transaction = null;
      }
    "
    :on-executed="() => (isExecuted = true)"
  >
    <template #successHeading>Hbar transferred successfully</template>
    <template #successContent>
      <div class="mt-4">
        <template
          v-for="account of Object.entries(balanceAdjustmentsPerAccount)"
          :key="account.accountId"
        >
          <div class="mt-3">
            <p class="text-small d-flex justify-content-between align-items">
              <span class="text-bold text-secondary">Account ID:</span>
              <span>{{ account[0] }}</span>
            </p>
            <p class="text-small d-flex justify-content-between align-items">
              <span class="text-bold text-secondary">Balance:</span>
              <span>{{ new Hbar(account[1]) }}</span>
            </p>
          </div>
        </template>
      </div>
    </template>
  </TransactionProcessor>
</template>
