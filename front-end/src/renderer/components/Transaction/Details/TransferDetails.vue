<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { Transaction, TransferTransaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { isUserLoggedIn } from '@renderer/utils';
import HBarTransferDetails from './TransferDetails/HBarTransferDetails.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  linkedAccounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});
</script>
<template>
  <div v-if="props.transaction instanceof TransferTransaction && true" class="mt-5">
    <div class="row">
      <HBarTransferDetails
        :hbar-transfers="props.transaction.hbarTransfersList"
        :linkedAccounts="linkedAccounts"
      />
    </div>
  </div>
</template>
