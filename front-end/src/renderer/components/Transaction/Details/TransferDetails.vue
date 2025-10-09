<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import { Transaction, Transfer, TransferTransaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { getAccountIdWithChecksum, isUserLoggedIn, stringifyHbar } from '@renderer/utils';
import { AccountInfoCache } from '@renderer/utils/accountInfoCache.ts';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);
const transfersExceedingBalance = ref<Transfer[]>([]);
const transferParsingComplete = ref(false);

/* Computed */
const errorMessage = computed(() => {
  let result: string | null;
  if (transfersExceedingBalance.value.length > 0) {
    result = `Insufficient balance for transfer`;
  } else {
    result = null;
  }
  return result;
});

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!(props.transaction instanceof TransferTransaction)) {
    throw new Error('Transaction is not Transfer Transaction');
  }

  const accountInfoCache = new AccountInfoCache();
  for (const transfer of props.transaction.hbarTransfersList) {
    if (transfer.amount.isNegative()) {
      const accountInfo = await accountInfoCache.fetch(
        transfer.accountId.toString(),
        network.mirrorNodeBaseURL,
      );
      if (
        accountInfo &&
        transfer.amount.negated().toBigNumber().isGreaterThan(accountInfo.balance.toBigNumber())
      ) {
        transfersExceedingBalance.value.push(transfer);
      }
    }
  }
  transferParsingComplete.value = true;

  linkedAccounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});

/* Functions */
const balanceExceeded = (transfer: Transfer): boolean => {
  return transfersExceedingBalance.value.some(t => t.accountId === transfer.accountId);
};
</script>
<template>
  <div v-if="transaction instanceof TransferTransaction && true" class="mt-5">
    <!-- Hbar transfers -->
    <div v-if="transferParsingComplete" class="row">
      <div class="col-6">
        <div class="mt-3">
          <template v-for="debit in transaction.hbarTransfersList" :key="debit.accountId">
            <div v-if="debit.amount.isNegative()" class="mt-3">
              <div class="row align-items-center px-3">
                <div
                  class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
                >
                  <template
                    v-if="
                      (
                        linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                          ?.nickname || ''
                      ).length > 0
                    "
                  >
                    <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>

                    <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                      <p class="text-small text-semi-bold me-2">
                        {{
                          linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                            ?.nickname
                        }}
                      </p>
                      <p class="text-secondary text-micro overflow-hidden">
                        ({{ getAccountIdWithChecksum(debit.accountId.toString()) }})
                      </p>
                    </div>
                  </template>
                  <template v-else>
                    <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>
                    <p
                      class="text-secondary text-small overflow-hidden"
                      data-testid="p-transfer-from-account-details"
                    >
                      {{ getAccountIdWithChecksum(debit.accountId.toString()) }}
                    </p>
                  </template>
                </div>
                <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                  <template v-if="balanceExceeded(debit)">
                    <p
                      class="text-danger text-small text-bold overflow-hidden"
                      data-testid="p-transfer-from-amount-details"
                    >
                      {{ stringifyHbar(debit.amount)
                      }}<span
                        v-if="transfersExceedingBalance.length > 0"
                        class="bi bi-exclamation-triangle-fill ms-2"
                      ></span>
                    </p>
                  </template>
                  <template v-else>
                    <p
                      class="text-secondary text-small text-bold overflow-hidden"
                      data-testid="p-transfer-from-amount-details"
                    >
                      {{ stringifyHbar(debit.amount)
                      }}<span
                        v-if="transfersExceedingBalance.length > 0"
                        class="invisible bi bi-exclamation-triangle-fill ms-2"
                      ></span>
                    </p>
                  </template>
                </div>
              </div>
              <hr class="separator" />
            </div>
          </template>
        </div>
        <p v-if="errorMessage" class="text-danger text-small text-end mt-3">{{ errorMessage }}</p>
      </div>
      <div class="col-6">
        <div class="mt-3">
          <template v-for="credit in transaction.hbarTransfersList" :key="credit.accountId">
            <div v-if="!credit.amount.isNegative()" class="mt-3">
              <div class="row align-items-center px-3">
                <div
                  class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
                >
                  <template
                    v-if="
                      (
                        linkedAccounts.find(la => la.account_id === credit.accountId.toString())
                          ?.nickname || ''
                      ).length > 0
                    "
                  >
                    <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                      <p class="text-small text-semi-bold me-2">
                        {{
                          linkedAccounts.find(la => la.account_id === credit.accountId.toString())
                            ?.nickname
                        }}
                      </p>
                      <p
                        class="text-secondary text-micro overflow-hidden"
                        data-testid="p-transfer-to-account-details"
                      >
                        ({{ getAccountIdWithChecksum(credit.accountId.toString()) }})
                      </p>
                    </div>
                  </template>
                  <template v-else>
                    <p
                      class="text-secondary text-small overflow-hidden"
                      data-testid="p-transfer-to-account-details"
                    >
                      {{ getAccountIdWithChecksum(credit.accountId.toString()) }}
                    </p>
                  </template>
                </div>
                <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                  <p
                    class="text-secondary text-small text-bold overflow-hidden"
                    data-testid="p-transfer-to-amount-details"
                  >
                    {{ stringifyHbar(credit.amount) }}
                  </p>
                </div>
              </div>
              <hr class="separator" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
