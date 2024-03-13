<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Hbar, KeyList, Transaction, TransferTransaction, Transfer } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft, updateDraft } from '@renderer/services/transactionDraftsService';

import {
  getDateTimeLocalInputValue,
  getTransactionFromBytes,
  isAccountId,
  stringifyHbar,
} from '@renderer/utils';

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
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref<Hbar>(new Hbar(2));

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

    // TO GET REQUIRED KEYS
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
    .setMaxTransactionFee(maxTransactionFee.value);

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
        totalBalanceAdjustments > 10 ||
        totalBalanceAdjustments === 0
      "
      heading-text="Transfer Hbar Transaction"
      class="flex-1"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee as Hbar"
      class="mt-6"
    />

    <div class="border rounded p-5 mt-5">
      <div class="row">
        <div class="col-5 flex-1">
          <!-- <TransferCard
            account-label="From"
            @handle-add-transfer="handleAddSenderTransfer"
            :show-approved="true"
            :show-balance="true"
            :spender="payerData.accountIdFormatted.value"
            :button-disabled="totalBalanceAdjustments >= 10"
          /> -->
          <TransferCard
            account-label="From"
            @handle-add-transfer="handleAddSenderTransfer"
            :show-balance="true"
            :button-disabled="totalBalanceAdjustments >= 10"
            :clear-on-add-transfer="true"
          />
        </div>
        <div class="col-1 align-self-center text-center">
          <span class="bi bi-arrow-right"></span>
        </div>
        <div class="col-5 flex-1">
          <TransferCard
            account-label="To"
            @handle-add-transfer="handleAddReceiverTransfer"
            :button-disabled="totalBalanceAdjustments >= 10"
            :clear-on-add-transfer="true"
          />
        </div>
      </div>

      <div class="row mt-3">
        <div class="col-5 flex-1">
          <div class="mt-3">
            <template v-for="(debit, i) in transfers" :key="debit.accountId">
              <div v-if="debit.amount.isNegative()" class="mt-3">
                <div class="row align-items-center px-3">
                  <div class="col-4 overflow-hidden">
                    <p class="text-small text-secondary overflow-hidden">
                      {{ debit.accountId }} {{ debit.isApproved ? '(Approved)' : '' }}
                    </p>
                  </div>
                  <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                    <p class="text-small text-secondary overflow-hidden">
                      {{ stringifyHbar(debit.amount as Hbar) }}
                    </p>
                  </div>
                  <div class="col-2 col-lg-1 text-end">
                    <span
                      class="bi bi-x-lg text-small text-secondary cursor-pointer"
                      @click="() => transfers.splice(i, 1)"
                    ></span>
                  </div>
                </div>
                <hr class="separator" />
              </div>
            </template>
          </div>
        </div>
        <div class="col-1"></div>
        <div class="col-5 flex-1">
          <div class="mt-3">
            <template v-for="(credit, i) in transfers" :key="credit.accountId">
              <div v-if="!credit.amount.isNegative()" class="mt-3">
                <div class="row align-items-center px-3">
                  <div class="col-4 overflow-hidden">
                    <p class="text-small text-secondary overflow-hidden">
                      {{ credit.accountId }}
                    </p>
                  </div>
                  <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                    <p class="text-small text-secondary overflow-hidden">
                      {{ stringifyHbar(credit.amount as Hbar) }}
                    </p>
                  </div>
                  <div class="col-2 col-lg-1 text-end">
                    <span
                      class="bi bi-x-lg text-small text-secondary cursor-pointer"
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

      <div class="d-flex justify-content-between flex-wrap overflow-hidden gap-3 mt-5">
        <p class="text-small">
          <span>{{ totalBalanceAdjustments }}</span>
          <span class="text-secondary">
            Adjustment{{ totalBalanceAdjustments != 1 ? 's' : '' }}</span
          >
        </p>
        <p class="text-small text-wrap">
          <span class="text-secondary">Balance</span> <span>{{ stringifyHbar(totalBalance) }}</span>
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
        maxTransactionFee = new Hbar(2);
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
