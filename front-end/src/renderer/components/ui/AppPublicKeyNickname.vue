<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { PublicKey } from '@hiero-ledger/sdk';
import { extractIdentifier, formatPublicKey } from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache.ts';
import useCreateTooltip from '@renderer/composables/useCreateTooltip';

const KEY_PREFIX_LENGTH = 6;
const KEY_SUFFIX_LENGTH = 6;

/* Props */
const props = defineProps<{
  publicKey: PublicKey | string;
  signed?: boolean;
  external?: boolean;
  truncateKey?: boolean;
}>();

/* Injected */
const publicKeyOwnerCache = AppCache.inject().backendPublicKeyOwner;

/* State */
const formattedPublicKey = ref('');
const keyRef = ref<HTMLElement | null>(null);

/* Composables */
useCreateTooltip(keyRef);

/* Computed */
const value = computed(() => {
  return props.publicKey instanceof PublicKey ? props.publicKey.toStringRaw() : props.publicKey;
});

const identifier = computed(() => extractIdentifier(formattedPublicKey.value));

const isKeyTruncated = computed(() => {
  const pk = identifier.value?.pk ?? '';
  return !!props.truncateKey && pk.length > KEY_PREFIX_LENGTH + KEY_SUFFIX_LENGTH;
});

const displayKey = computed(() => {
  const pk = identifier.value?.pk ?? '';
  return isKeyTruncated.value
    ? `${pk.slice(0, KEY_PREFIX_LENGTH)} ... ${pk.slice(-KEY_SUFFIX_LENGTH)}`
    : pk;
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
    <span v-else-if="!signed && identifier">
      <span class="text-pink me-2">{{ identifier?.identifier }}</span>
      <span
        ref="keyRef"
        :data-bs-toggle="isKeyTruncated ? 'tooltip' : ''"
        data-bs-custom-class="no-wrap-tooltip"
        data-bs-trigger="hover"
        data-bs-placement="top"
        :data-bs-title="isKeyTruncated ? identifier?.pk : ''"
        >{{ `(${displayKey})` }}</span
      >
    </span>
    <span v-else>{{ formattedPublicKey }}</span>
    <span v-if="props.external" class="badge bg-info text-break ms-2">External</span>
  </span>
</template>
