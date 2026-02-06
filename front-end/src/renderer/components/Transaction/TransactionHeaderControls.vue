<script setup lang="ts">
import type { Transaction } from '@hashgraph/sdk';

import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import AppReminderSelect from '@renderer/components/selects/AppReminderSelect.vue';

/* Props */
defineProps<{
  createButtonLabel: string;
  validStart: Date;
  headingText?: string;
  loading?: boolean;
  isProcessed?: boolean;
  createTransaction?: () => Transaction;
  createButtonDisabled?: boolean;
  description?: string;
}>();

/* Emits */
defineEmits<{
  (event: 'add-to-group'): void;
  (event: 'edit-group-item'): void;
  (event: 'draft-saved'): void;
}>();

/* Models */
const submitManually = defineModel<boolean>('submitManually', { required: true });
const reminder = defineModel<number | null>('reminder', { required: true });

/* Stores */
const user = useUserStore();

/* Composables */
useCreateTooltips();

/* State */
const showAddReminder = ref(false);

/* Watchers */
watch(showAddReminder, show => {
  if (!show) {
    reminder.value = null;
  }
});
</script>
<template>
  <div>
    <div class="d-flex align-items-center">
      <AppButton
        type="button"
        color="secondary"
        class="btn-icon-only me-4"
        data-testid="button-back"
        @click="$router.back()"
      >
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold" data-testid="h2-transaction-type">{{ headingText }}</h2>
    </div>

    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mt-3">
      <div class="d-flex gap-4">
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
              v-model:checked="submitManually"
              label="Schedule manually"
              name="submit-manually"
            />
          </div>

          <div>
            <AppCheckBox
              v-model:checked="showAddReminder"
              label="Add reminder"
              name="add-reminder"
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
            v-on:draft-saved="$emit('draft-saved')"
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

    <Transition name="fade" mode="out-in">
      <template v-if="showAddReminder">
        <div class="mt-3">
          <AppReminderSelect v-model="reminder" :event-date="validStart" />
        </div>
      </template>
    </Transition>
  </div>
</template>
