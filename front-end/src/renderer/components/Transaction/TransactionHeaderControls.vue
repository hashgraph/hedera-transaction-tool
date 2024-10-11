<script setup lang="ts">
import type { Transaction } from '@hashgraph/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Props */
defineProps<{
  isProcessed: boolean;
  createTransaction: () => Transaction;
  description: string;
  createButtonLabel: string;
  createButtonDisabled?: boolean;
  headingText?: string;
}>();

/* Emits */
defineEmits<{
  (event: 'add-to-group'): void;
  (event: 'edit-group-item'): void;
}>();
</script>
<template>
  <div>
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="$router.back()">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold" data-testid="h2-transaction-type">{{ headingText }}</h2>
    </div>
    <div class="flex-centered justify-content-end flex-wrap gap-3 mt-3">
      <template v-if="!($route.query.group === 'true')">
        <div class="flex-centered justify-content-end flex-wrap gap-3 mt-3">
          <div class="flex-centered justify-content-end flex-wrap gap-3 mt-3">
            <SaveDraftButton
              :get-transaction="() => createTransaction()"
              :description="description"
              :is-executed="isProcessed"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit"
              :disabled="createButtonDisabled"
            >
              <span class="bi bi-send"></span>
              {{ createButtonLabel }}</AppButton
            >
          </div>
        </div>
      </template>
      <template v-else>
        <div>
          <AppButton
            color="primary"
            type="button"
            @click="$route.params.seq ? $emit('edit-group-item') : $emit('add-to-group')"
            :disabled="createButtonDisabled"
          >
            <span class="bi bi-plus-lg" />
            {{ $route.params.seq ? 'Edit Group Item' : 'Add to Group' }}
          </AppButton>
        </div>
      </template>
    </div>
  </div>
</template>
