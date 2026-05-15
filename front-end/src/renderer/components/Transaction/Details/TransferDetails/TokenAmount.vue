<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TokenId } from '@hiero-ledger/sdk';
import { AppCache } from '@renderer/caches/AppCache';
import useNetwork from '@renderer/stores/storeNetwork.ts';
import { formatTokenAmount } from '@renderer/caches/mirrorNode/TokenByIdCache';

/* Props */
const props = defineProps<{
  amount: Long;
  tokenId: TokenId;
}>();

/* Injected */
const appCache = AppCache.inject();

/* Stores */
const network = useNetwork();

/* State */
const formattedAmount = ref<string | null>(null);
const tokenSymbol = ref<string | null>(null);

/* Hook */
watch(
  [() => props.amount, () => props.tokenId],
  async () => {
    try {
      const tokenInfo = await appCache.mirrorTokenById.lookup(
        props.tokenId.toString(),
        network.mirrorNodeBaseURL,
      );
      if (tokenInfo !== null) {
        formattedAmount.value = formatTokenAmount(props.amount.toBigInt(), tokenInfo);
        tokenSymbol.value = tokenInfo.symbol;
      } else {
        formattedAmount.value = props.amount.toString();
        tokenSymbol.value = props.tokenId.toString();
      }
    } catch {
      formattedAmount.value = props.amount.toString();
      tokenSymbol.value = props.tokenId.toString();
    }
  },
  { immediate: true },
);
</script>

<template>
  <span
    v-if="formattedAmount !== null"
    class="text-secondary text-small text-bold overflow-hidden"
    data-testid="p-transfer-from-amount-details"
  >
    {{ formattedAmount }} <span v-if="tokenSymbol !== null"> {{ tokenSymbol }} </span>
  </span>
</template>

<style scoped></style>
