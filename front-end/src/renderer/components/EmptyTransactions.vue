<script setup lang="ts">
import { ref } from 'vue';

import { useRoute, useRouter } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

/* Props */
defineProps<{
  group?: boolean;
}>();

/* Composables */
const route = useRoute();
const router = useRouter();

/* State */
const isTransactionSelectionModalShown = ref(false);
</script>
<template>
  <div class="flex-centered flex-column text-center" v-bind="$attrs">
    <div>
      <span class="bi bi-arrow-left-right text-huge text-secondary"></span>
    </div>
    <div class="mt-3">
      <p data-testid="p-empty-transaction-text" class="text-title text-semi-bold">There are no Transactions at the moment.</p>
    </div>
    <div class="mt-3">
      <p class="text-main text-muted">
        Create your Transaction, Sign Immediately or Save it to Drafts
      </p>
    </div>
    <div class="mt-3" v-if="route.path == '/create-transaction-group'">
      <AppButton class="text-main text-pink" @click="isTransactionSelectionModalShown = true"
        >Create New</AppButton
      >
    </div>
    <div class="mt-3 d-flex flex-column" v-if="route.path == '/transactions'">
      <AppButton class="text-main text-pink" @click="isTransactionSelectionModalShown = true"
        >Create New Transaction</AppButton
      >
      <AppButton class="text-main text-pink" @click="router.push('/create-transaction-group')"
        >Create New Transaction Group</AppButton
      >
    </div>
  </div>
  <TransactionSelectionModal
    v-if="isTransactionSelectionModalShown"
    v-model:show="isTransactionSelectionModalShown"
    :group="group"
  />
</template>
