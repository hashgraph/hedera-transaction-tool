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
import type { TransactionBrowserEntry } from './TransactionBrowserEntry';
import AccountApproveAllowanceDetails from '@renderer/components/Transaction/Details/AccountApproveAllowanceDetails.vue';
import DeleteAccountDetails from '@renderer/components/Transaction/Details/DeleteAccountDetails.vue';
import FileDetails from '@renderer/components/Transaction/Details/FileDetails.vue';
import AccountDetails from '@renderer/components/Transaction/Details/AccountDetails.vue';
import TransferDetails from '@renderer/components/Transaction/Details/TransferDetails.vue';
import FreezeDetails from '@renderer/components/Transaction/Details/FreezeDetails.vue';
import SystemDetails from '@renderer/components/Transaction/Details/SystemDetails.vue';
import NodeDetails from '@renderer/components/Transaction/Details/NodeDetails.vue';

/* Props */
const props = defineProps<{
  entries: TransactionBrowserEntry[];
}>();

/* Models */
const show = defineModel<boolean>('show', { required: true });
const currentIndex = defineModel<number>('currentIndex', { required: true });

/* Emits */
const emit = defineEmits(['previous', 'next']);

/* Computed */
const currentItem = computed(() => {
  let result: ITransactionBrowserItem | null;
  if (currentIndex.value >= 0 && currentIndex.value <= props.entries.length - 1) {
    result = props.entries[currentIndex.value].item;
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

const transactionDetailsTitle = computed(() => transactionType.value!);
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
                :disabled="currentIndex >= props.entries.length - 1"
                color="secondary"
                @click.prevent="emit('next')"
                >Next</AppButton
              >
            </div>
          </div>

          <div class="fill-remaining mt-5">
            <div class="row flex-wrap">

              <!-- Description -->
              <TransactionBrowserSection :alone="true">
                <template v-slot:label>Description</template>
                <template v-slot:value>{{
                  description && description.trim().length > 0 ? description : 'None'
                }}</template>
              </TransactionBrowserSection>

              <!-- Transaction ID -->
              <TransactionBrowserSection>
                <template v-slot:label>Transaction ID</template>
                <template v-slot:value>
                  <TransactionId :transaction-id="transactionId"> </TransactionId>
                </template>
              </TransactionBrowserSection>

              <!-- Creator Email -->
              <TransactionBrowserSection>
                <template v-slot:label>Creator</template>
                <template v-slot:value>{{
                  creatorEmail && creatorEmail.trim().length > 0 ? creatorEmail : 'None'
                }}</template>
              </TransactionBrowserSection>

              <!-- Valid Start -->
              <TransactionBrowserSection>
                <template v-slot:label>Valid Start</template>
                <template v-slot:value>{{ validStartDate }}</template>
              </TransactionBrowserSection>

              <TransactionBrowserSectionHeading :title="transactionDetailsTitle" />

              <FileDetails
                v-if="
                  transaction instanceof FileCreateTransaction ||
                  transaction instanceof FileUpdateTransaction ||
                  transaction instanceof FileAppendTransaction
                "
                :organization-transaction="null"
                :transaction="transaction"
              />

              <AccountDetails
                v-if="
                  transaction instanceof AccountCreateTransaction ||
                  transaction instanceof AccountUpdateTransaction
                "
                :transaction="transaction"
                :organization-transaction="null"
              />

              <DeleteAccountDetails
                v-if="transaction instanceof AccountDeleteTransaction"
                :transaction="transaction"
                :organization-transaction="null"
              />

              <TransferDetails
                v-if="transaction instanceof TransferTransaction"
                :transaction="transaction"
              />

              <AccountApproveAllowanceDetails
                v-if="transaction instanceof AccountAllowanceApproveTransaction"
                :transaction="transaction"
              />

              <FreezeDetails
                v-if="transaction instanceof FreezeTransaction"
                :transaction="transaction"
              />

              <SystemDetails
                v-if="
                  transaction instanceof SystemDeleteTransaction ||
                  transaction instanceof SystemUndeleteTransaction
                "
                :organization-transaction="null"
                :transaction="transaction"
              />

              <NodeDetails
                v-if="
                  transaction instanceof NodeCreateTransaction ||
                  transaction instanceof NodeUpdateTransaction ||
                  transaction instanceof NodeDeleteTransaction
                "
                :organization-transaction="null"
                :transaction="transaction"
              />

              <TransactionBrowserSectionHeading title="Collected Signatures" />
              <TransactionBrowserKeySection :item="currentItem" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
