<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionImportRow from '@renderer/components/TransactionImportRow.vue';
import { type V1ImportCandidate, type V1ImportFilterResult } from '@shared/interfaces';
import { SignatureMap } from '@hashgraph/sdk';
import { makeSignatureMap } from '@renderer/utils/signatureTools.ts';

/* Props */
const props = defineProps<{
  filterResult: V1ImportFilterResult;
}>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* State */
const selectedCandidates = ref<V1ImportCandidate[]>([]);
const importing = ref(false);

/* Computed */
const isAllSelected = computed(() => {
  return (
    props.filterResult.candidates.length > 0 &&
    selectedCandidates.value.length === props.filterResult.candidates.length
  );
});

/* Handlers */
const handleCheckboxChecked = (candidate: V1ImportCandidate, checked: boolean) => {
  if (checked) {
    selectedCandidates.value.push(candidate);
  } else {
    selectedCandidates.value = selectedCandidates.value.filter(
      c => c.filePath !== candidate.filePath,
    );
  }
};

const handleSelectAll = (checked: boolean) => {
  selectedCandidates.value = checked ? props.filterResult.candidates : [];
};

const handleSubmit = async () => {
  importing.value = true;
  try {
    await importSelectedCandidates();
  } finally {
    importing.value = false;
    show.value = false;
  }
};

/* Functions */

const importSelectedCandidates = async (): Promise<void> => {
  const candidatesByTX = new Map<string, V1ImportCandidate[]>(); // trasnaction -> candidate[]
  for (const candidate of selectedCandidates.value) {
    const candidates = candidatesByTX.get(candidate.transactionId);
    if (candidates) {
      candidates.push(candidate);
    } else {
      candidatesByTX.set(candidate.transactionId, [candidate]);
    }
  }

  const importFailures: string[] = [];
  for (const [transactionId, candidates] of candidatesByTX) {
    try {
      const signatureMap = makeSignatureMap(candidates);
      await importSignatureMap(transactionId, signatureMap);
    } catch {
      importFailures.push(transactionId);
    }
  }

  if (importFailures.length > 0) {
    console.log('Import failed for the following transaction: ' + JSON.stringify(importFailures));
  }
};

const importSignatureMap = async (transactionId: string, signatureMap: SignatureMap) => {
  console.log('SignatureMap for ' + transactionId);
  console.log('============');
  console.log(JSON.stringify(signatureMap, null, 2));
};

/* Watchers */

watch(
  () => props.filterResult.candidates,
  (candidates: V1ImportCandidate[]) => {
    selectedCandidates.value = candidates;
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
              v-for="(candidate, index) in props.filterResult.candidates"
              :key="candidate.filePath"
              class="d-flex flex-row align-items-center gap-3"
            >
              <AppCheckBox
                :checked="selectedCandidates.some(r => r.filePath === candidate.filePath)"
                @update:checked="handleCheckboxChecked(candidate, $event)"
                :name="`checkbox-key-${index}`"
                class="cursor-pointer"
                :data-testid="`checkbox-key-${index}`"
              />
              <TransactionImportRow :candidate="candidate" />
            </li>
          </ul>
        </div>
        <div class="d-flex justify-content-end mt-4">
          <AppButton
            data-testid="button-import-files-public"
            :disabled="selectedCandidates.length === 0"
            :loading="importing"
            loading-text="Importing…"
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
