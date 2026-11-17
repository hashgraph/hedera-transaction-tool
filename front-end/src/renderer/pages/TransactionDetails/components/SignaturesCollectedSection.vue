<script setup lang="ts">
import { computed, ref } from 'vue';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import CollapsibleSearchField from '@renderer/components/SearchField/CollapsibleSearchField.vue';
import { type SignatureAudit } from '@renderer/utils';
import { PublicKey } from '@hiero-ledger/sdk';

/* Props */
const props = defineProps<{
  signatureKeyObject: SignatureAudit | null;
  signersPublicKeys: string[];
  showExternal: boolean;
}>();

/* State */
const searchText = ref('');

/* Computed */
const showSearchButton = computed(
  () => props.signatureKeyObject !== null && props.signatureKeyObject.signatureKeys.length > 1,
);

const highlightKey = computed(() => {
  let result: PublicKey | null;
  try {
    result = PublicKey.fromStringECDSA(searchText.value);
  } catch {
    try {
      result = PublicKey.fromStringED25519(searchText.value);
    } catch {
      result = null;
    }
  }
  return result;
});
</script>

<template>
  <h2 v-if="props.signatureKeyObject !== null">
    <span class="text-title text-bold me-3">Signatures Collected</span>
    <CollapsibleSearchField
      v-if="showSearchButton"
      v-model:search-text="searchText"
      placeholder="Enter public key to search…"
    />
  </h2>
  <div v-if="props.signatureKeyObject !== null" class="text-small mt-5">
    <SignatureStatus
      :signature-key-object="props.signatureKeyObject"
      :public-keys-signed="signersPublicKeys"
      :show-external="showExternal"
    />
  </div>
</template>

<style scoped></style>
