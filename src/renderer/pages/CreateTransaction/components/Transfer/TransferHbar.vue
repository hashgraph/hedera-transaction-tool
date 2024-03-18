<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Hbar, KeyList, Transaction, TransferTransaction, Transfer } from '@hashgraph/sdk';

import { HederaAccount } from '@prisma/client';
import { IAccountInfoParsed } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft, updateDraft } from '@renderer/services/transactionDraftsService';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';
import { getAll } from '@renderer/services/accountsService';

import {
  getDateTimeLocalInputValue,
  getTransactionFromBytes,
  isAccountId,
  stringifyHbar,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransferCard from '@renderer/components/TransferCard.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const savedDraft = ref<{
  id: string;
  created_at: Date;
  updated_at: Date;
  user_id: string;
  type: string;
  transactionBytes: string;
  isTemplate: boolean | null;
  details: string | null;
}>();
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const transfers = ref<Transfer[]>([]);
const accountInfos = ref<{
  [key: string]: IAccountInfoParsed;
}>({});
const linkedAccounts = ref<HederaAccount[]>([]);

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

    await transactionProcessor.value?.process(getRequiredKeys());
  } catch (err: any) {
    console.log(err);

    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleDraftAdded = async (id: string) => {
  if (savedDraft.value?.isTemplate) return;

  await updateDraft(id, { details: JSON.stringify({ transfers: transfers.value }) });
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<TransferTransaction>(draft.transactionBytes);
  savedDraft.value = draft;

  if (draft) {
    transaction.value = draftTransaction;

    if (draft.details) {
      try {
        const details = JSON.parse(draft.details);
        const loadedTransfers = details.transfers.map(
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

        const accountIds = loadedTransfers.map(t => t.accountId.toString());
        for (const accountId of accountIds) {
          if (!accountInfos.value[accountId]) {
            accountInfos.value[accountId] = await getAccountInfo(
              accountId,
              network.mirrorNodeBaseURL,
            );
          }
        }

        transfers.value = loadedTransfers;
      } catch {
        /* Empty */
      }
    }
  }
};

const handleAddSenderTransfer = async (accountId: string, amount: Hbar, isApproved: boolean) => {
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

    if (!accountInfos.value[accountId]) {
      accountInfos.value[accountId] = await getAccountInfo(accountId, network.mirrorNodeBaseURL);
      accountInfos.value = { ...accountInfos.value };
    }
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

const handleReceiverRestButtonClick = (accountId: string, isApproved: boolean) => {
  if (totalBalance.value.isNegative() && !isApproved) {
    handleAddReceiverTransfer(accountId, totalBalance.value.negated());
  }
};

const handleAddReceiverTransfer = async (accountId: string, amount: Hbar) => {
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

    if (!accountInfos.value[accountId]) {
      accountInfos.value[accountId] = await getAccountInfo(accountId, network.mirrorNodeBaseURL);
      accountInfos.value = { ...accountInfos.value };
    }
  } else {
    creditted.amount = new Hbar(creditted.amount.toBigNumber().plus(amount.toBigNumber()));
  }

  transfers.value = [...transfers.value];
};

const handleRemoveTransfer = async (index: number) => {
  transfers.value.splice(index, 1);
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

function getRequiredKeys() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  const keyList = new KeyList([payerData.key.value]);

  const addedKeysForAccountIds: string[] = [];
  for (const transfer of transfers.value.filter(t => !t.isApproved)) {
    const accountId = transfer.accountId.toString();
    const key = accountInfos.value[accountId].key;
    const receiverSigRequired = accountInfos.value[accountId].receiverSignatureRequired;

    if (
      key &&
      !addedKeysForAccountIds.includes(accountId) &&
      (transfer.amount.isNegative() || (!transfer.amount.isNegative() && receiverSigRequired))
    ) {
      keyList.push(key);
      addedKeysForAccountIds.push(accountId);
    }
  }

  return keyList;
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
  linkedAccounts.value = await getAll(user.data.id);
});
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Transfer Hbar Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :handle-draft-added="handleDraftAdded"
            :handle-draft-updated="handleDraftAdded"
            :is-executed="isExecuted"
          />
          <AppButton
            color="primary"
            type="submit"
            :disabled="
              !payerData.accountId.value ||
              !totalBalance.toBigNumber().isEqualTo(0) ||
              totalBalanceAdjustments > 10 ||
              totalBalanceAdjustments === 0
            "
          >
            <span class="bi bi-send"></span>
            Sign & Submit</AppButton
          >
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <hr class="separator my-5" />

      <div class="border rounded fill-remaining p-5">
        <div class="row">
          <div class="col-5 flex-1">
            <TransferCard
              account-label="From"
              @transfer-added="handleAddSenderTransfer"
              :show-balance-in-label="true"
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
              @transfer-added="handleAddReceiverTransfer"
              @rest-added="handleReceiverRestButtonClick"
              :button-disabled="totalBalanceAdjustments >= 10"
              :add-rest-disabled="
                totalBalance.toBigNumber().isGreaterThanOrEqualTo(0) ||
                totalBalanceAdjustments >= 10
              "
              :show-transfer-rest="true"
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
                    <div
                      class="col-4 flex-centered justify-content-start flex-wrap overflow-hidden"
                    >
                      <template
                        v-if="
                          linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                        "
                      >
                        <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">
                          Approved
                        </p>

                        <div class="flex-centered justify-content-start flex-wrap">
                          <p class="text-small text-semi-bold me-2">
                            {{
                              linkedAccounts.find(
                                la => la.account_id === debit.accountId.toString(),
                              )?.nickname
                            }}
                          </p>
                          <p class="text-secondary text-micro overflow-hidden">
                            {{ debit.accountId }}
                          </p>
                        </div>
                      </template>
                      <template v-else>
                        <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">
                          Approved
                        </p>
                        <p class="text-secondary text-small overflow-hidden">
                          {{ debit.accountId }}
                        </p>
                      </template>
                    </div>
                    <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                      <p class="text-secondary text-small text-bold overflow-hidden">
                        {{ stringifyHbar(debit.amount as Hbar) }}
                      </p>
                    </div>
                    <div class="col-2 col-lg-1 text-end">
                      <span
                        class="bi bi-x-lg text-secondary text-small cursor-pointer"
                        @click="handleRemoveTransfer(i)"
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
                    <div
                      class="col-4 flex-centered justify-content-start flex-wrap overflow-hidden"
                    >
                      <template
                        v-if="
                          linkedAccounts.find(la => la.account_id === credit.accountId.toString())
                        "
                      >
                        <div class="flex-centered justify-content-start flex-wrap">
                          <p class="text-small text-semi-bold me-2">
                            {{
                              linkedAccounts.find(
                                la => la.account_id === credit.accountId.toString(),
                              )?.nickname
                            }}
                          </p>
                          <p class="text-secondary text-micro overflow-hidden">
                            {{ credit.accountId }}
                          </p>
                        </div>
                      </template>
                      <template v-else>
                        <p class="text-secondary text-small overflow-hidden">
                          {{ credit.accountId }}
                        </p>
                      </template>
                    </div>
                    <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                      <p class="text-secondary text-small text-bold overflow-hidden">
                        {{ stringifyHbar(credit.amount as Hbar) }}
                      </p>
                    </div>
                    <div class="col-2 col-lg-1 text-end">
                      <span
                        class="bi bi-x-lg text-secondary text-small cursor-pointer"
                        @click="handleRemoveTransfer(i)"
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
            <span class="text-secondary">Balance</span>
            <span> {{ ` ${stringifyHbar(totalBalance)}` }}</span>
          </p>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :on-close-success-modal-click="
        () => {
          transfers = [];
        }
      "
      :on-executed="
        () => {
          isExecuted = true;
          validStart = '';
          maxTransactionFee = new Hbar(2);
          transaction = null;
        }
      "
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
  </div>
</template>
