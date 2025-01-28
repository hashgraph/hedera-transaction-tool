<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { TransferTransaction, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';
import useAccountId from '@renderer/composables/useAccountId';

import { isUserLoggedIn, stringifyHbar } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Composables */
const accountData = useAccountId();

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!(props.transaction instanceof TransferTransaction)) {
    throw new Error('Transaction is not Transfer Transaction');
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
  <div v-if="transaction instanceof TransferTransaction && true" class="mt-5">
    <!-- Hbar transfers -->
    <div class="row">
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

                    <div class="flex-centered justify-content-start flex-wrap">
                      <p class="text-small text-semi-bold me-2">
                        {{
                          linkedAccounts.find(la => la.account_id === debit.accountId.toString())
                            ?.nickname
                        }}
                      </p>
                      <p class="text-secondary text-micro overflow-hidden">
                        {{ accountData.getAccountIdWithChecksum(debit.accountId.toString()) }}
                      </p>
                    </div>
                  </template>
                  <template v-else>
                    <p v-if="debit.isApproved" class="text-small text-semi-bold me-2">Approved</p>
                    <p
                      class="text-secondary text-small overflow-hidden"
                      data-testid="p-transfer-from-account-details"
                    >
                      {{ accountData.getAccountIdWithChecksum(debit.accountId.toString()) }}
                    </p>
                  </template>
                </div>
                <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
                  <p
                    class="text-secondary text-small text-bold overflow-hidden"
                    data-testid="p-transfer-from-amount-details"
                  >
                    {{ stringifyHbar(debit.amount) }}
                  </p>
                </div>
              </div>
              <hr class="separator" />
            </div>
          </template>
        </div>
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
                    <div class="flex-centered justify-content-start flex-wrap">
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
                        {{ accountData.getAccountIdWithChecksum(credit.accountId.toString()) }}
                      </p>
                    </div>
                  </template>
                  <template v-else>
                    <p
                      class="text-secondary text-small overflow-hidden"
                      data-testid="p-transfer-to-account-details"
                    >
                      {{ accountData.getAccountIdWithChecksum(credit.accountId.toString()) }}
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
