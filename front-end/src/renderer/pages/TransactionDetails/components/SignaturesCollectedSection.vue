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

const matchCount = computed(() => searchIndex.matches.value.length);
</script>

<template>
  <h2 v-if="props.signatureKeyObject !== null">
    <span class="text-title text-bold me-3">Signatures Collected</span>
  </h2>
  <div class="d-flex align-items-center mt-3 gap-3">
    <SearchField
      v-if="showSearchButton"
      v-model:search-text="searchText"
      placeholder="Enter public key to search…"
    />
    <span v-if="matchCount == 1" class="text-success text-micro">1 match</span>
    <span v-if="matchCount > 1" class="text-success text-micro">{{ matchCount }} matches</span>
  </div>
  <div v-if="props.signatureKeyObject !== null" class="text-small mt-5">
    <SignatureStatus
      :signature-key-object="props.signatureKeyObject"
      :public-keys-signed="signersPublicKeys"
      :show-external="showExternal"
    />
  </div>
</template>

<style scoped></style>
