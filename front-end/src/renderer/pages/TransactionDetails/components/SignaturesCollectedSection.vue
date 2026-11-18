<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const searchIndex = new SearchIndex();

/* Providers */
SearchIndex.provide(searchIndex);

/* Computed */
const showSearchButton = computed(
  () => props.signatureKeyObject !== null && props.signatureKeyObject.signatureKeys.length > 1,
);

const trimmedSearchText = computed(() => searchText.value.trim());

const matches = computed<HTMLElement[]>(() => {
  const result: HTMLElement[] = [];
  if (trimmedSearchText.value.length > 0) {
    for (const [candidate, elements] of searchIndex.candidates.value) {
      if (candidate.startsWith(trimmedSearchText.value)) {
        elements.forEach(e => result.push(e));
      }
    }
    result.sort((a, b) => {
      if (a === b) return 0;
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1; // a comes before b
      }
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1; // a comes after b
      }
      return 0;
    });
  }
  return result;
});

const firstMatch = computed<HTMLElement | null>(() => {
  return matches.value.length > 0 ? matches.value[0] : null;
});

/* Hooks */
watch(firstMatch, newValue => {
  searchIndex.highlightElement.value = newValue;
  // if (newValue !== null) {
  //   nextTick(() => newValue.scrollIntoView({ inline: 'center' }));
  // }
});
</script>

<template>
  <h2 v-if="props.signatureKeyObject !== null" class="d-flex align-items-center">
    <span class="text-title text-bold me-3">Signatures Collected</span>
    <SearchField
      v-if="showSearchButton"
      v-model:search-text="searchText"
      placeholder="Enter public key to search…"
    />
    <span v-if="matches.length > 0" class="bi bi-check text-title text-success" />
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
