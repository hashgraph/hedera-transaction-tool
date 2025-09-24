<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionImportRow from '@renderer/components/TransactionImportRow.vue';
import {
  type ITransactionFull,
  type V1ImportCandidate,
  type V1ImportFilterResult,
} from '@shared/interfaces';
import { TransactionId } from '@hashgraph/sdk';
import { makeSignatureMap } from '@renderer/utils/signatureTools.ts';
import { getTransactionById, importSignatures } from '@renderer/services/organization';
import useUserStore from '@renderer/stores/storeUser.ts';

/* Props */
const props = defineProps<{
  filterResult: V1ImportFilterResult;
}>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* State */
const selectedCandidates = ref<V1ImportCandidate[]>([]);
const transactionMap = ref<Map<string, ITransactionFull>>(new Map()); // transactionId -> ITransactionFull
const importing = ref(false);
const user = useUserStore();

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
  const serverUrl = user.selectedOrganization!.serverUrl;
  for (const [transactionId, candidates] of candidatesByTX) {
    const transaction = transactionMap.value.get(transactionId);
    if (transaction) {
      try {
        const signatureMap = makeSignatureMap(candidates).toJSON();
        await importSignatures(serverUrl, transaction.id, signatureMap);
      } catch {
        importFailures.push(transactionId);
      }
    }
  }

  if (importFailures.length > 0) {
    console.log('Import failed for the following transaction: ' + JSON.stringify(importFailures));
  }
};

const candidatesDidChange = async (newValue: V1ImportCandidate[]) => {
  const serverUrl = user.selectedOrganization?.serverUrl;

  // 1) Retrieves transaction info from backend
  transactionMap.value.clear();
  if (serverUrl) {
    for (const candidate of newValue) {
      if (transactionMap.value.get(candidate.transactionId) === undefined) {
        try {
          const transactionId = TransactionId.fromString(candidate.transactionId);
          const t = await getTransactionById(serverUrl, transactionId);
          transactionMap.value.set(candidate.transactionId, t);
        } catch (error) {
          console.log('error=' + error);
        }
      }
    }
  }

  // 2) Initializes selectedCandidates
  // => only transactions existing in back-end are pre-selected
  selectedCandidates.value = [];
  for (const candidate of props.filterResult.candidates) {
    if (transactionMap.value.get(candidate.transactionId) !== undefined) {
      selectedCandidates.value.push(candidate);
    }
  }
};

const findBackendInfo = (candidate: V1ImportCandidate): ITransactionFull | null => {
  return transactionMap.value.get(candidate.transactionId) ?? null;
};

/* Watchers */

watch(() => props.filterResult.candidates, candidatesDidChange, { immediate: true });
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
                :disabled="findBackendInfo(candidate) == null"
              />
              <TransactionImportRow
                :candidate="candidate"
                :backend-info="findBackendInfo(candidate)"
              />
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
