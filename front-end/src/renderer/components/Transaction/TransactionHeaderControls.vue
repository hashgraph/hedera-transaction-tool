<script setup lang="ts">
import type { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Props */
defineProps<{
  submitManually: boolean;
  createButtonLabel: string;
  headingText?: string;
  loading?: boolean;
  isProcessed?: boolean;
  createTransaction?: () => Transaction;
  createButtonDisabled?: boolean;
  description?: string;
}>();

/* Emits */
defineEmits<{
  (event: 'update:submit-manually', value: boolean): void;
  (event: 'add-to-group'): void;
  (event: 'edit-group-item'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
useCreateTooltips();
</script>
<template>
  <div>
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="$router.back()">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold" data-testid="h2-transaction-type">{{ headingText }}</h2>
    </div>
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mt-3">
      <div>
        <template
          v-if="
            !($route.query.group === 'true') && isLoggedInOrganization(user.selectedOrganization)
          "
        >
          <div
            data-bs-toggle="tooltip"
            data-bs-trigger="hover"
            data-bs-placement="bottom"
            data-bs-custom-class="wide-xxl-tooltip"
            data-bs-title="Transaction will have to be submitted to the network manually."
          >
            <AppCheckBox
              :checked="submitManually"
              @update:checked="$emit('update:submit-manually', $event)"
              label="Submit manually"
              name="submit-manually"
            />
          </div>
        </template>
      </div>
      <template v-if="!($route.query.group === 'true')">
        <div class="flex-centered justify-content-end flex-wrap gap-3">
          <SaveDraftButton
            v-if="createTransaction && typeof isProcessed === 'boolean'"
            :get-transaction="createTransaction"
            :description="description || ''"
            :is-executed="isProcessed"
          />
          <AppButton
            color="primary"
            type="submit"
            :loading="loading"
            :disabled="createButtonDisabled"
            data-testid="button-header-create"
          >
            <span class="bi bi-send"></span>
            {{ createButtonLabel }}</AppButton
          >
        </div>
      </template>
      <template v-else>
        <div>
          <AppButton
            color="primary"
            type="button"
            data-testid="button-add-to-group"
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
