<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { PublicKey } from '@hiero-ledger/sdk';
import { extractIdentifier, formatPublicKey } from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache.ts';

/* Props */
const props = defineProps<{
  publicKey: PublicKey | string;
  signed?: boolean;
  external?: boolean;
}>();

/* Injected */
const publicKeyOwnerCache = AppCache.inject().backendPublicKeyOwner;

/* State */
const formattedPublicKey = ref('');

/* Computed */
const value = computed(() => {
  return props.publicKey instanceof PublicKey ? props.publicKey.toStringRaw() : props.publicKey;
});

watchEffect(async () => {
  if (value.value) {
    formattedPublicKey.value = await formatPublicKey(value.value, publicKeyOwnerCache);
  }
});
</script>
<template>
  <span v-if="formattedPublicKey">
    <span v-if="signed" class="text-success">{{ formattedPublicKey }}</span>
    <span v-else-if="!signed && extractIdentifier(formattedPublicKey)">
      <span class="text-pink me-2">{{ extractIdentifier(formattedPublicKey)?.identifier }}</span>
      <span>{{ `(${extractIdentifier(formattedPublicKey)?.pk})` }}</span>
    </span>
    <span v-else>{{ formattedPublicKey }}</span>
    <span v-if="props.external" class="badge bg-info text-break ms-2">External</span>
  </span>
</template>
