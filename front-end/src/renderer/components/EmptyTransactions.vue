<script setup lang="ts">
import { ref } from 'vue';

import { useRouter } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

/* Props */
defineProps<{
  mode: 'create-group' | 'transactions-tab' | 'group-details';
}>();

/* Composables */
const router = useRouter();

/* State */
const isTransactionSelectionModalShown = ref(false);
</script>
<template>
  <div class="flex-centered flex-column text-center" v-bind="$attrs">
    <!-- Icon -->
    <div>
      <span class="bi bi-arrow-left-right text-huge text-secondary"></span>
    </div>

    <!-- Title -->
    <template v-if="['group-details'].includes(mode)">
      <div class="mt-3">
        <p data-testid="p-empty-transaction-text" class="text-title text-semi-bold">
          There are no Transactions in the group.
        </p>
      </div>
    </template>
    <template v-else>
      <div class="mt-3">
        <p data-testid="p-empty-transaction-text" class="text-title text-semi-bold">
          There are no Transactions at the moment.
        </p>
      </div>
    </template>

    <!-- Description -->
    <template v-if="['create-group', 'transactions-tab'].includes(mode)">
      <div class="mt-3">
        <p class="text-main text-muted">
          Create your Transaction, Sign Immediately or Save it to Drafts
        </p>
      </div>
    </template>

    <!-- Action Buttons -->
    <template v-if="['create-group', 'transactions-tab'].includes(mode)">
      <div class="mt-3">
        <AppButton
          type="button"
          class="text-main text-pink"
          :size="'small'"
          @click="isTransactionSelectionModalShown = true"
          >Create New Transaction</AppButton
        >
      </div>
    </template>
    <template v-if="['transactions-tab'].includes(mode)">
      <div class="mt-2">
        <AppButton
          type="button"
          class="text-main text-pink"
          :size="'small'"
          @click="router.push('/create-transaction-group')"
          >Create New Transaction Group</AppButton
        >
      </div>
    </template>
  </div>
  <TransactionSelectionModal
    v-if="isTransactionSelectionModalShown"
    v-model:show="isTransactionSelectionModalShown"
    :group="mode === 'create-group'"
  />
</template>
