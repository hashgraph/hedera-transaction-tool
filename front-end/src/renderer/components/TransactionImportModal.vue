<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import type { TransactionSearchResult } from '@main/services/localUser';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionImportRow from '@renderer/components/TransactionImportRow.vue';
import { decode } from 'msgpackr';
import { type ITransactionFull, TransactionStatus } from '@shared/interfaces';
import { hexToUint8Array } from '@renderer/utils';

/* Props */
const props = defineProps<{
  searchResults: TransactionSearchResult[];
}>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* State */
const selectedResults = ref<TransactionSearchResult[]>([]);

/* Computed */
const isAllSelected = computed(() => {
  return (
    props.searchResults.length > 0 && selectedResults.value.length === props.searchResults.length
  );
});

/* Handlers */
const handleCheckboxChecked = (match: TransactionSearchResult, checked: boolean) => {
  if (checked) {
    selectedResults.value = [...selectedResults.value, match];
  } else {
    selectedResults.value = selectedResults.value.filter(m => m.tx2FilePath !== match.tx2FilePath);
  }
};

const handleSelectAll = (checked: boolean) => {
  selectedResults.value = checked ? [...props.searchResults] : [];
};

const handleSubmit = async () => {
  show.value = false;
};

/* Functions */

const filterCandidates = (candidates: TransactionSearchResult[]) => {
  const result: TransactionSearchResult[] = [];
  for (const r of candidates) {
    try {
      const tx2Bytes = hexToUint8Array(r.tx2Bytes);
      const decodedTransaction = decode(tx2Bytes) as ITransactionFull;
      switch (decodedTransaction.status) {
        case TransactionStatus.NEW:
        case TransactionStatus.WAITING_FOR_SIGNATURES:
        case TransactionStatus.WAITING_FOR_EXECUTION:
          result.push(r);
          break;
      }
    } catch {}
  }
  return result;
}

/* Watchers */

watch(
  () => props.searchResults,
  (candidates: TransactionSearchResult[]) => {
    selectedResults.value = filterCandidates(candidates);
  },
  { immediate: true },
);

</script>

<template>
  <AppModal v-model:show="show" class="large-modal">
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
      <form @submit.prevent="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Select transactions to import</h3>
        <div class="border rounded p-3 mt-4">
          <div class="d-flex flex-row align-items-center gap-3 border-bottom mb-2">
            <AppCheckBox
              :checked="isAllSelected"
              @update:checked="handleSelectAll"
              name="select-all-keys"
              data-testid="checkbox-select-all-public-keys"
              class="cursor-pointer"
            />
            <span>Select all</span>
          </div>
          <ul class="overflow-x-hidden" style="max-height: 30vh">
            <li
              v-for="(searchResult, index) in props.searchResults"
              :key="searchResult.tx2FilePath"
              class="d-flex flex-row align-items-center gap-3"
            >
              <AppCheckBox
                :checked="selectedResults.some(r => r.tx2FilePath === searchResult.tx2FilePath)"
                @update:checked="handleCheckboxChecked(searchResult, $event)"
                :name="`checkbox-key-${index}`"
                class="cursor-pointer"
                :data-testid="`checkbox-key-${index}`"
              />
              <TransactionImportRow :search-result="searchResult" />
            </li>
          </ul>
        </div>
        <div class="d-flex justify-content-end mt-4">
          <AppButton
            data-testid="button-import-files-public"
            :disabled="selectedResults.length === 0"
            type="submit"
            color="primary"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>

<style scoped></style>
