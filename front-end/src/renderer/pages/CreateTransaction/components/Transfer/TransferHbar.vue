<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Hbar, KeyList, Transaction, TransferTransaction, Transfer, Key } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { HederaAccount } from '@prisma/client';
import { IAccountInfoParsed } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';
import { getAll } from '@renderer/services/accountsService';

import {
  getTransactionFromBytes,
  getPropagationButtonLabel,
  isAccountId,
  stringifyHbar,
} from '@renderer/utils';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransferCard from '@renderer/components/TransferCard.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
// const savedDraft = ref<{
//   id: string;
//   created_at: Date;
//   updated_at: Date;
//   user_id: string;
//   type: string;
//   transactionBytes: string;
//   isTemplate: boolean | null;
//   details: string | null;
// }>();
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));
const transactionMemo = ref('');

const transfers = ref<Transfer[]>([]);
const accountInfos = ref<{
  [key: string]: IAccountInfoParsed;
}>({});
const linkedAccounts = ref<HederaAccount[]>([]);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);

  const addedKeysForAccountIds: string[] = [];
  for (const transfer of transfers.value.filter(t => !t.isApproved)) {
    const accountId = transfer.accountId.toString();

    const key = accountInfos.value[accountId]?.key;
    const receiverSigRequired = accountInfos.value[accountId]?.receiverSignatureRequired;

    if (
      key &&
      !addedKeysForAccountIds.includes(accountId) &&
      (transfer.amount.isNegative() || (!transfer.amount.isNegative() && receiverSigRequired))
    ) {
      keyList.push(key);
      addedKeysForAccountIds.push(accountId);
    }
  }

  return new KeyList(keyList);
});

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

    await transactionProcessor.value?.process(await getRequiredKeys());
  } catch (err: any) {
    console.log(err);

    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId && !route.query.groupIndex) return;
  let draftTransactionBytes: string | null = null;
  if (!route.query.group) {
    const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
    draftTransactionBytes = draft.transactionBytes;
  } else if (route.query.groupIndex) {
    draftTransactionBytes =
      transactionGroup.groupItems[Number(route.query.groupIndex)].transactionBytes.toString();
  }

  if (draftTransactionBytes) {
    const draftTransaction = getTransactionFromBytes<TransferTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;
    transactionMemo.value = draftTransaction.transactionMemo || '';

    const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');

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

const handleLocalStored = (id: string) => {
  toast.success('Transfer Hbar Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(id);
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

function handleAddToGroup() {
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (payerData.key.value instanceof KeyList) {
    for (const key of payerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }
  // TODO: handle single key?
  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'TransferTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

function handleEditGroupItem() {
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (payerData.key.value instanceof KeyList) {
    for (const key of payerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountAllowanceApproveTransaction',
    accountId: '',
    seq: route.params.seq[0],
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

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

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

async function getRequiredKeys() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  const keyList = new KeyList([payerData.key.value]);

  const addedKeysForAccountIds: string[] = [];
  for (const transfer of transfers.value.filter(t => !t.isApproved)) {
    const accountId = transfer.accountId.toString();

    if (!accountInfos.value[accountId]) {
      accountInfos.value[accountId] = await getAccountInfo(accountId, network.mirrorNodeBaseURL);
      accountInfos.value = { ...accountInfos.value };
    }

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

async function redirectToDetails(id: string | number) {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  linkedAccounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Transfer Hbar Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :get-transaction-bytes="() => createTransaction().toBytes()"
              :is-executed="isExecuted || isSubmitted"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit-file-create"
              :disabled="!payerData.key || !payerData.isValid.value"
            >
              <span class="bi bi-send"></span>
              {{
                getPropagationButtonLabel(
                  transactionKey,
                  user.keyPairs,
                  Boolean(user.selectedOrganization),
                )
              }}</AppButton
            >
          </div>
          <div v-else>
            <AppButton
              v-if="$route.params.seq"
              color="primary"
              type="button"
              @click="handleEditGroupItem"
            >
              <span class="bi bi-plus-lg" />
              Edit Group Item
            </AppButton>
            <AppButton v-else color="primary" type="button" @click="handleAddToGroup">
              <span class="bi bi-plus-lg" />
              Add to Group
            </AppButton>
          </div>
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <div class="row mt-6">
        <div class="form-group col-8 col-xxxl-6">
          <label class="form-label">Transaction Memo</label>
          <AppInput
            v-model="transactionMemo"
            :filled="true"
            maxlength="100"
            data-testid="input-transaction-memo-for-transfer-tokens"
            placeholder="Enter Transaction Memo"
          />
        </div>
      </div>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="border rounded p-5">
          <div class="row">
            <div class="col-5 flex-1">
              <TransferCard
                account-label="From"
                @transfer-added="handleAddSenderTransfer"
                :show-balance-in-label="true"
                :button-disabled="totalBalanceAdjustments >= 10"
                :clear-on-add-transfer="true"
                :restrict-amount-to-balance="true"
                data-test-id-account-id-input="input-transfer-from-account"
                data-test-id-hbar-input="input-transfer-from-amount"
                data-test-id-add-rest="button-transfer-from-rest"
                data-test-id-add-transfer="button-add-transfer-from"
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
                data-test-id-account-id-input="input-transfer-to-account"
                data-test-id-hbar-input="input-transfer-to-amount"
                data-test-id-add-rest="button-transfer-to-rest"
                data-test-id-add-transfer="button-add-transfer-to"
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
                          <p
                            class="text-secondary text-small overflow-hidden"
                            data-testid="p-debit-account"
                          >
                            {{ debit.accountId }}
                          </p>
                        </template>
                      </div>
                      <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                        <p
                          class="text-secondary text-small text-bold overflow-hidden"
                          data-testid="p-debit-amount"
                        >
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
                          <p
                            class="text-secondary text-small overflow-hidden"
                            data-testid="p-credit-account"
                          >
                            {{ credit.accountId }}
                          </p>
                        </template>
                      </div>
                      <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                        <p
                          class="text-secondary text-small text-bold overflow-hidden"
                          data-testid="p-hbar-amount"
                        >
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

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Observers</label>
            <UsersGroup v-model:userIds="observers" :addable="true" :editable="true" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Approvers</label>
            <ApproversList v-model:approvers="approvers" :editable="true" />
          </div>
        </div>
      </div>
    </form>
    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :observers="observers"
      :approvers="approvers"
      :on-executed="
        () => {
          isExecuted = true;
        }
      "
      :on-submitted="handleSubmit"
      :on-local-stored="handleLocalStored"
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
