<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { Transfer } from '@hiero-ledger/sdk';
import { getAccountIdWithChecksum, stringifyHbar } from '@renderer/utils';
import type { HederaAccount } from '@prisma/client';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import { AppCache } from '@renderer/caches/AppCache.ts';

/* Props */
const props = defineProps<{
  hbarTransfers: Transfer[];
  linkedAccounts: HederaAccount[];
}>();

/* Stores */
const network = useNetworkStore();

/* Injected */
const accountByIdCache = AppCache.inject().mirrorAccountById;

/* State */
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
  for (const transfer of props.hbarTransfers) {
    if (transfer.amount.isNegative()) {
      const accountInfo = await accountByIdCache.lookup(
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
});

/* Functions */
const balanceExceeded = (transfer: Transfer): boolean => {
  return transfersExceedingBalance.value.some(t => t.accountId === transfer.accountId);
};
</script>

<template>
  <template v-if="transferParsingComplete">
    <div class="col-6">
      <div class="mt-3">
        <template v-for="debit in props.hbarTransfers" :key="debit.accountId">
          <div v-if="debit.amount.isNegative()" class="mt-3">
            <div class="row align-items-center px-3">
              <div
                class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
              >
                <template
                  v-if="
                    (
                      props.linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                        ?.nickname || ''
                    ).length > 0
                  "
                >
                  <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>

                  <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                    <p class="text-small text-semi-bold me-2">
                      {{
                        props.linkedAccounts.find(
                          la => la.account_id === debit.accountId.toString(),
                        )?.nickname
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
        <template v-for="credit in props.hbarTransfers" :key="credit.accountId">
          <div v-if="!credit.amount.isNegative()" class="mt-3">
            <div class="row align-items-center px-3">
              <div
                class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
              >
                <template
                  v-if="
                    (
                      props.linkedAccounts.find(la => la.account_id === credit.accountId.toString())
                        ?.nickname || ''
                    ).length > 0
                  "
                >
                  <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                    <p class="text-small text-semi-bold me-2">
                      {{
                        props.linkedAccounts.find(
                          la => la.account_id === credit.accountId.toString(),
                        )?.nickname
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
  </template>
</template>

<style scoped></style>
