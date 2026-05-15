<script setup lang="ts">
import { computed } from 'vue';
import { AccountId, TokenId, TransferTransaction } from '@hiero-ledger/sdk';
import type { HederaAccount } from '@prisma/client';
import { getAccountIdWithChecksum } from '@renderer/utils';
import TokenAmount from '@renderer/components/Transaction/Details/TransferDetails/TokenAmount.vue';

/* Props */
const props = defineProps<{
  tokenId: TokenId;
  transaction: TransferTransaction;
  linkedAccounts: HederaAccount[];
}>();

/* Computed */
const tokenTransfers = computed(() => {
  const result: { accountId: AccountId; amount: Long }[] = [];
  const map = props.transaction.tokenTransfers.get(props.tokenId);
  if (map !== null) {
    for (const accountId of map.keys()) {
      result.push({ accountId: accountId, amount: map.get(accountId)! });
    }
  }
  return result;
});

/* Functions */
const findNickname = (accountId: AccountId) => {
  return props.linkedAccounts.find(la => la.account_id === accountId.toString())?.nickname ?? null;
};
</script>

<template>
  <div class="col-6">
    <div class="mt-3">
      <template v-for="debit in tokenTransfers" :key="debit.accountId">
        <div v-if="debit.amount.isNegative()" class="mt-3">
          <div class="row align-items-center px-3">
            <div
              class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
            >
              <template v-if="findNickname(debit.accountId) !== null">
                <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                  <p class="text-small text-semi-bold me-2">
                    {{ findNickname(debit.accountId) }}
                  </p>
                  <p class="text-secondary text-micro overflow-hidden">
                    ({{ getAccountIdWithChecksum(debit.accountId.toString()) }})
                  </p>
                </div>
              </template>
              <template v-else>
                <p
                  class="text-secondary text-small overflow-hidden"
                  data-testid="p-transfer-from-account-details"
                >
                  {{ getAccountIdWithChecksum(debit.accountId.toString()) }}
                </p>
              </template>
            </div>
            <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
              <TokenAmount :amount="debit.amount" :token-id="props.tokenId" />
            </div>
          </div>
          <hr class="separator" />
        </div>
      </template>
    </div>
  </div>
  <div class="col-6">
    <div class="mt-3">
      <template v-for="credit in tokenTransfers" :key="credit.accountId">
        <div v-if="credit.amount.isPositive()" class="mt-3">
          <div class="row align-items-center px-3">
            <div
              class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
            >
              <template v-if="findNickname(credit.accountId) !== null">
                <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                  <p class="text-small text-semi-bold me-2">
                    {{ findNickname(credit.accountId) }}
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
              <TokenAmount :amount="credit.amount" :token-id="props.tokenId" />
            </div>
          </div>
          <hr class="separator" />
        </div>
      </template>
    </div>
  </div>
</template>
