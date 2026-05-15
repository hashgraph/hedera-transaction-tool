<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TokenId } from '@hiero-ledger/sdk';
import { AppCache } from '@renderer/caches/AppCache';
import useNetwork from '@renderer/stores/storeNetwork.ts';

/* Props */
const props = defineProps<{
  serial: Long;
  tokenId: TokenId;
}>();

/* Injected */
const appCache = AppCache.inject();

/* Stores */
const network = useNetwork();

/* State */
const tokenSymbol = ref<string | null>(null);

/* Hook */
watch(
  [() => props.serial, () => props.tokenId],
  async () => {
    try {
      const tokenInfo = await appCache.mirrorTokenById.lookup(
        props.tokenId.toString(),
        network.mirrorNodeBaseURL,
      );
      if (tokenInfo !== null) {
        tokenSymbol.value = tokenInfo.symbol;
      } else {
        tokenSymbol.value = props.tokenId.toString();
      }
    } catch {
      tokenSymbol.value = props.tokenId.toString();
    }
  },
  { immediate: true },
);
</script>

<template>
  <span
    v-if="tokenSymbol !== null"
    class="text-secondary text-small text-bold overflow-hidden"
    data-testid="p-transfer-from-amount-details"
  >
    {{ tokenSymbol }} #{{ props.serial }}
  </span>
</template>

<style scoped></style>
