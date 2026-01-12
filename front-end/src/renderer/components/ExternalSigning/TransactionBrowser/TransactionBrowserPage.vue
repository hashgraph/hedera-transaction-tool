<script setup lang="ts">
import { computed } from 'vue';
import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FileAppendTransaction,
  FreezeTransaction,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  TransferTransaction,
  Transaction as SDKTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
} from '@hashgraph/sdk';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import { hexToUint8Array } from '@renderer/utils';
import { getTransactionType, getTransactionValidStart } from '@renderer/utils/sdk/transactions.ts';
import TransactionBrowserSection from './TransactionBrowserSection.vue';
import TransactionBrowserSectionHeading from './TransactionBrowserSectionHeading.vue';
import TransactionBrowserKeySection from './TransactionBrowserKeySection.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* Models */
const show = defineModel<boolean>('show', { required: true });
const currentIndex = defineModel<number>('currentIndex', { required: true });

/* Emits */
const emit = defineEmits(['previous', 'next']);

/* Computed */
const currentItem = computed(() => {
  let result: ITransactionBrowserItem | null;
  if (currentIndex.value >= 0 && currentIndex.value <= props.items.length - 1) {
    result = props.items[currentIndex.value];
  } else {
    result = null;
  }
  return result;
});

const transaction = computed(() => {
  let result: SDKTransaction | null;
  try {
    const transactionBytes = hexToUint8Array(currentItem.value!.transactionBytes);
    result = SDKTransaction.fromBytes(transactionBytes);
  } catch {
    result = null;
  }
  return result;
});
const transactionId = computed(() => transaction.value?.transactionId ?? '');
const transactionType = computed(() => {
  return transaction.value !== null ? getTransactionType(transaction.value, false, true) : null;
});
const description = computed(() => currentItem.value!.description ?? '');
const validStartDate = computed(() => {
  return transaction.value !== null ? getTransactionValidStart(transaction.value) : null;
});
const creatorEmail = computed(() => currentItem.value!.creatorEmail ?? '');

const transactionDetailsTitle = computed(() => transactionType.value + ' Detail');
</script>

<template>
  <AppModal v-if="currentItem" v-model:show="show" class="full-screen-modal-in-modal">
    <div class="p-5">
      <div class="flex-column-100 overflow-hidden">
        <div class="flex-column-100">
          <div class="flex-centered justify-content-between flex-wrap gap-4">
            <div class="d-flex align-items-center">
              <AppButton
                class="btn-icon-only me-4"
                color="secondary"
                data-testid="button-back"
                type="button"
                @click="show = false"
              >
                <i class="bi bi-arrow-left"></i>
              </AppButton>

              <h2 class="text-title text-bold">Transaction Details</h2>
            </div>

            <div class="flex-centered gap-4">
              <AppButton
                :disabled="currentIndex <= 0"
                color="secondary"
                @click.prevent="emit('previous')"
                >Previous</AppButton
              >

              <AppButton
                :disabled="currentIndex >= props.items.length - 1"
                color="secondary"
                @click.prevent="emit('next')"
                >Next</AppButton
              >
            </div>
          </div>

          <div class="fill-remaining mt-5">
            <div class="row flex-wrap">
              <!-- Description -->
              <TransactionBrowserSection>
                <template v-slot:label>Description</template>
                <template v-slot:value>{{ description }}</template>
              </TransactionBrowserSection>

              <TransactionBrowserSection>
                <template v-slot:label>TransactionId</template>
                <template v-slot:value>
                  <TransactionId :transaction-id="transactionId"> </TransactionId>
                </template>
              </TransactionBrowserSection>

              <TransactionBrowserSectionHeading title="Creation Details" />

              <TransactionBrowserSection>
                <template v-slot:label>Creator</template>
                <template v-slot:value>{{ creatorEmail }}</template>
              </TransactionBrowserSection>

              <TransactionBrowserSectionHeading title="Transaction Details" />

              <TransactionBrowserSection>
                <template v-slot:label>Transaction Type</template>
                <template v-slot:value>{{ transactionType }}</template>
              </TransactionBrowserSection>

              <TransactionBrowserSection>
                <template v-slot:label>Valid Start</template>
                <template v-slot:value>{{ validStartDate }}</template>
              </TransactionBrowserSection>

              <TransactionBrowserSectionHeading :title="transactionDetailsTitle" />

              <div
                v-if="
                  transaction instanceof FileCreateTransaction ||
                  transaction instanceof FileUpdateTransaction ||
                  transaction instanceof FileAppendTransaction
                "
              >
                File transaction properties
              </div>
              <div
                v-if="
                  transaction instanceof AccountCreateTransaction ||
                  transaction instanceof AccountUpdateTransaction
                "
              >
                Account delete transaction properties
              </div>
              <div v-if="transaction instanceof AccountDeleteTransaction">
                Account transaction properties
              </div>
              <div v-if="transaction instanceof TransferTransaction">
                Transfer transaction properties
              </div>
              <div v-if="transaction instanceof AccountAllowanceApproveTransaction">
                Allowance transaction properties
              </div>
              <div v-if="transaction instanceof FreezeTransaction">
                Freeze transaction properties
              </div>
              <div
                v-if="
                  transaction instanceof SystemDeleteTransaction ||
                  transaction instanceof SystemUndeleteTransaction
                "
              >
                System delete/undelete transaction properties
              </div>
              <div
                v-if="
                  transaction instanceof NodeCreateTransaction ||
                  transaction instanceof NodeUpdateTransaction ||
                  transaction instanceof NodeDeleteTransaction
                "
              >
                System delete/undelete transaction properties
              </div>

              <TransactionBrowserSectionHeading title="Collected Signatures" />
              <TransactionBrowserKeySection :item="currentItem" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
