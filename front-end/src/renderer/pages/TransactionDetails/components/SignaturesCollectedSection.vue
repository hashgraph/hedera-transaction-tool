<script setup lang="ts">
import { computed, ref } from 'vue';
import SignatureStatus from '@renderer/components/SignatureStatus/SignatureStatus.vue';
import SearchField from '@renderer/components/SearchField/SearchField.vue';
import { type SignatureAudit } from '@renderer/utils';
import { SearchIndex } from '@renderer/components/SignatureStatus/SearchIndex.ts';

/* Props */
const props = defineProps<{
  signatureKeyObject: SignatureAudit | null;
  signersPublicKeys: string[];
  showExternal: boolean;
}>();

/* State */
const searchText = ref('');
const searchIndex = new SearchIndex(searchText);

/* Providers */
SearchIndex.provide(searchIndex);

/* Computed */
const showSearchButton = computed(
  () => props.signatureKeyObject !== null && props.signatureKeyObject.signatureKeys.length > 1,
);
</script>

<template>
  <h2 v-if="props.signatureKeyObject !== null" class="d-flex align-items-center">
    <span class="text-title text-bold me-3">Signatures Collected</span>
    <SearchField
      v-if="showSearchButton"
      v-model:search-text="searchText"
      placeholder="Enter public key to search…"
    />
    <span v-if="searchIndex.matches.value.length > 0" class="bi bi-check text-title text-success" />
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
