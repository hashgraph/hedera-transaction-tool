<script setup lang="ts">
import { computed } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import type { TransactionMatch } from '@main/services/localUser';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  transactions: TransactionMatch[];
}>();

/* Model */
const selectedTransactions = defineModel<TransactionMatch[]>('selectedTransactions', {
  required: true,
});

/* State */
const show = defineModel<boolean>('show', { required: true });

/* Computed */
// const selectedCount = computed(() => selectedTransactions.value.length);

const isAllSelected = computed(() => {
  return (
    props.transactions.length > 0 && selectedTransactions.value.length === props.transactions.length
  );
});

/* Handlers */
const handleCheckboxChecked = (match: TransactionMatch, checked: boolean) => {
  if (checked) {
    selectedTransactions.value = [...selectedTransactions.value, match];
  } else {
    selectedTransactions.value = selectedTransactions.value.filter(
      m => m.filePath !== match.filePath,
    );
  }
};

const handleSelectAll = (checked: boolean) => {
  selectedTransactions.value = checked ? [...props.transactions] : [];
};

const handleSubmit = () => {};

/* Function */
function basename(filePath: string): string {
  return filePath.substring(filePath.lastIndexOf('/') + 1);
}
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
              v-for="(match, index) in props.transactions"
              :key="match.filePath"
              class="d-flex flex-row align-items-center gap-3"
            >
              <AppCheckBox
                :checked="selectedTransactions.some(m => m.filePath === match.filePath)"
                @update:checked="handleCheckboxChecked(match, $event)"
                :name="`checkbox-key-${index}`"
                class="cursor-pointer"
                :data-testid="`checkbox-key-${index}`"
              />
              <div class="overflow-x-auto">
                <strong>{{ basename(match.filePath) }}</strong>
                <p class="text-muted small">{{ match.transactionBytes.length }} bytes</p>
              </div>
            </li>
          </ul>
        </div>
        <div class="d-flex justify-content-end mt-4">
          <AppButton
            data-testid="button-import-files-public"
            :disabled="selectedTransactions.length === 0"
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
