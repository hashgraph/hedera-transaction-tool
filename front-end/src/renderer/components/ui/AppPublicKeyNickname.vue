<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import { PublicKey } from '@hiero-ledger/sdk';
import { extractIdentifier, formatPublicKey } from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache.ts';
import useCreateTooltip from '@renderer/composables/useCreateTooltip';
import { SearchIndex } from '@renderer/components/SignatureStatus/SearchIndex.ts';
import Highlighter from '@renderer/components/ui/Highlighter.vue';

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
const searchIndex = SearchIndex.inject();

/* State */
const formattedPublicKey = ref('');
const keyRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);

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

const shouldHighlight = computed(() => {
  return containerRef.value === searchIndex.highlightElement.value;
});

/* Hooks */
watchEffect(async () => {
  if (value.value) {
    formattedPublicKey.value = await formatPublicKey(value.value, publicKeyOwnerCache);
  }
});

watch(containerRef, (newValue, oldValue) => {
  if (newValue !== null) {
    searchIndex.pushCandidate(value.value, newValue);
  } else if (oldValue !== null) {
    searchIndex.removeCandidate(value.value);
  }
});
</script>
<template>
  <span ref="containerRef" v-if="formattedPublicKey">
    <Highlighter :visible="shouldHighlight">
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
    </Highlighter>
  </span>
</template>
