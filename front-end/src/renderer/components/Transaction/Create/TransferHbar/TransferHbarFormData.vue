<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import type { IAccountInfoParsed } from '@shared/interfaces';
import type { TransferHbarData } from '@renderer/utils/sdk';

import { ref, onMounted, computed } from 'vue';
import { Hbar, Transfer } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';
import { getAll } from '@renderer/services/accountsService';

import { isUserLoggedIn, stringifyHbar } from '@renderer/utils';

import TransferCard from '@renderer/components/TransferCard.vue';

/* Props */
const props = defineProps<{
  data: TransferHbarData;
  accountInfos: {
    [key: string]: IAccountInfoParsed;
  };
  totalBalance: Hbar;
  totalBalanceAdjustments: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: TransferHbarData): void;
  (
    event: 'update:accountInfos',
    data: {
      [key: string]: IAccountInfoParsed;
    },
  ): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const transfersExceedingBalance = computed(() => {
  const result = [];
  for (const transfer of props.data.transfers) {
    if (transfer.amount.isNegative()) {
      const accountInfo = props.accountInfos[transfer.accountId.toString()];
      if (
        accountInfo &&
        transfer.amount.negated().toBigNumber().isGreaterThan(accountInfo.balance.toBigNumber())
      ) {
        result.push(transfer);
      }
    }
  }
  return result;
});

const errorMessage = computed(() => {
  let result: string | null;
  if (transfersExceedingBalance.value.length > 0) {
    result = `Insufficient balance for transfer`;
  } else {
    result = null;
  }
  return result;
});

/* Handlers */
const handleAddTransfer = async (accountId: string, amount: Hbar, isApproved: boolean) => {
  const transfers = [...props.data.transfers];
  for (const transfer of transfers) {
    if (
      transfer.accountId.toString() === accountId &&
      transfer.amount.isNegative() === amount.isNegative() &&
      transfer.isApproved === isApproved
    ) {
      transfer.amount = new Hbar(transfer.amount.toBigNumber().plus(amount.toBigNumber()));
      refreshTransfers(transfers);
      return;
    }
  }

  addTransfer(accountId, amount, isApproved);
  await ensureAccountInfoExists(accountId);
};

const handleAddSenderTransfer = async (accountId: string, amount: Hbar, isApproved: boolean) => {
  await handleAddTransfer(accountId, amount.negated(), isApproved);
};

const handleAddReceiverTransfer = async (accountId: string, amount: Hbar) => {
  await handleAddTransfer(accountId, amount, false);
};

const handleReceiverRestButtonClick = (accountId: string, isApproved: boolean) => {
  if (props.totalBalance.isNegative() && !isApproved) {
    handleAddReceiverTransfer(accountId, props.totalBalance.negated());
  }
};

/* Functions */
const balanceExceeded = (transfer: Transfer): boolean => {
  return transfersExceedingBalance.value.some(t => t.accountId === transfer.accountId);
};

const addTransfer = (accountId: string, amount: Hbar, isApproved: boolean) => {
  const newTransfer = new Transfer({
    accountId,
    amount,
    isApproved,
  });
  const updatedTransfers = [...props.data.transfers, newTransfer];
  refreshTransfers(updatedTransfers);
};

const removeTransfer = async (index: number) => {
  const transfers = [...props.data.transfers];
  transfers.splice(index, 1);
  refreshTransfers(transfers);
};

const refreshTransfers = (transfers?: Transfer[]) => {
  emit('update:data', {
    ...props.data,
    transfers: transfers || [...props.data.transfers],
  });
};

const ensureAccountInfoExists = async (accountId: string) => {
  if (!props.accountInfos[accountId]) {
    const info = await getAccountInfo(accountId, network.mirrorNodeBaseURL);
    if (info) {
      emit('update:accountInfos', {
        ...props.accountInfos,
        [accountId]: info,
      });
    }
  }
};

/* Hooks */
onMounted(async () => {
  if (isUserLoggedIn(user.personal)) {
    linkedAccounts.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
});
</script>
<template>
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
            totalBalance.toBigNumber().isGreaterThanOrEqualTo(0) || totalBalanceAdjustments >= 10
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
          <template v-for="(debit, i) in data.transfers" :key="debit.accountId">
            <div v-if="debit.amount.isNegative()" class="mt-3">
              <div class="row align-items-center px-3">
                <div class="col-4 flex-centered justify-content-start flex-wrap overflow-hidden">
                  <template
                    v-if="linkedAccounts.find(la => la.account_id === debit.accountId.toString())"
                  >
                    <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>

                    <div class="flex-centered justify-content-start flex-wrap">
                      <p class="text-small text-semi-bold me-2">
                        {{
                          linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                            ?.nickname
                        }}
                      </p>
                      <p class="text-secondary text-micro overflow-hidden">
                        {{ debit.accountId }}
                      </p>
                    </div>
                  </template>
                  <template v-else>
                    <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>
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
                    class="text-danger text-small text-bold overflow-hidden"
                    :class="{
                      'text-danger': balanceExceeded(debit),
                      'text-secondary': !balanceExceeded(debit),
                    }"
                    data-testid="p-debit-amount"
                  >
                    {{ stringifyHbar(debit.amount as Hbar)
                    }}<span
                    v-if="transfersExceedingBalance.length > 0"
                      class="bi bi-exclamation-triangle-fill ms-2"
                      :class="{'invisible': !balanceExceeded(debit)}"
                    ></span>
                  </p>
                </div>
                <div class="col-2 col-lg-1 text-end">
                  <span
                    class="bi bi-x-lg text-secondary text-small cursor-pointer"
                    @click="removeTransfer(i)"
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
          <template v-for="(credit, i) in data.transfers" :key="credit.accountId">
            <div v-if="!credit.amount.isNegative()" class="mt-3">
              <div class="row align-items-center px-3">
                <div class="col-4 flex-centered justify-content-start flex-wrap overflow-hidden">
                  <template
                    v-if="linkedAccounts.find(la => la.account_id === credit.accountId.toString())"
                  >
                    <div class="flex-centered justify-content-start flex-wrap">
                      <p class="text-small text-semi-bold me-2">
                        {{
                          linkedAccounts.find(la => la.account_id === credit.accountId.toString())
                            ?.nickname
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
                    @click="removeTransfer(i)"
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
        <span class="text-secondary"> Adjustment{{ totalBalanceAdjustments != 1 ? 's' : '' }}</span>
      </p>
      <p v-if="errorMessage" class="text-danger text-small">{{ errorMessage }}</p>
      <p class="text-small text-wrap">
        <span class="text-secondary">Balance</span>
        <span> {{ ` ${stringifyHbar(totalBalance)}` }}</span>
      </p>
    </div>
  </div>
</template>
