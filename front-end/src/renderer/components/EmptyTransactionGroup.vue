<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

/* State */
const isTransactionSelectionModalShown = ref(false);
</script>
<template>
  <div class="flex-centered flex-column text-center" v-bind="$attrs">
    <div>
      <span class="bi bi-arrow-left-right text-huge text-secondary"></span>
    </div>
    <div class="mt-3">
      <p class="text-title text-semi-bold">There are no Transaction Groups at the moment.</p>
    </div>
    <div class="mt-3">
      <p class="text-main text-muted">
        Create your Transaction, Sign Immediately or Save it to Drafts
      </p>
    </div>
    <div class="mt-3">
      <AppButton class="text-main text-pink" @click="isTransactionSelectionModalShown = true"
        ><i class="bi bi-plus-lg"></i> <span>Add Transaction</span></AppButton
      >
    </div>
  </div>
  <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" />
</template>
