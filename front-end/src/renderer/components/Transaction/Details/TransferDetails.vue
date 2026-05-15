<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { Transaction, TransferTransaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { isUserLoggedIn } from '@renderer/utils';
import HBarTransferDetails from './TransferDetails/HBarTransferDetails.vue';
import TokenTransferDetails from '@renderer/components/Transaction/Details/TransferDetails/TokenTransferDetails.vue';
import NftTransferDetails from '@renderer/components/Transaction/Details/TransferDetails/NftTransferDetails.vue';

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
      <template v-for="tokenId in props.transaction.tokenTransfers.keys()" :key="tokenId">
        <TokenTransferDetails
          :token-id="tokenId"
          :transaction="props.transaction"
          :linkedAccounts="linkedAccounts"
        />
      </template>
      <template v-for="tokenId in props.transaction.nftTransfers.keys()" :key="tokenId">
        <NftTransferDetails
          :token-id="tokenId"
          :transaction="props.transaction"
          :linkedAccounts="linkedAccounts"
        />
      </template>
    </div>
  </div>
</template>
