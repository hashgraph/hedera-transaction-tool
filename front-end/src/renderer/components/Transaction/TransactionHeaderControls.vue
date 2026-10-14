<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import AppReminderSelect from '@renderer/components/selects/AppReminderSelect.vue';

/* Props */
const props = defineProps<{
  createButtonLabel: string;
  validStart: Date;
  headingText?: string;
  loading?: boolean;
  isProcessed?: boolean;
  saveDraft?: () => Promise<void>;
  createButtonDisabled?: boolean;
  description?: string;
}>();

/* Emits */
defineEmits<{
  (event: 'add-to-group'): void;
  (event: 'edit-group-item'): void;
}>();

/* Models */
const submitManually = defineModel<boolean>('submitManually', { required: true });
const reminder = defineModel<number | null>('reminder', { required: true });

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const route = useRoute();

/* State */
const showAddReminder = ref(false);

/* Computed */
const showSubmitManually = computed(() => {
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;
  if (route.query.group !== 'true') return true;
  // Atomic groups aren't yet creatable from the UI (always false in the draft
  // store); sequential groups must not contain manual transactions, since a
  // manual item submitted mid-execution would run out of order.
  return !transactionGroup.sequential;
});

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
        log-label="back-to-transactions"
      >
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold" data-testid="h2-transaction-type">{{ headingText }}</h2>
    </div>

    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mt-3">
      <div class="d-flex gap-4">
        <div v-if="showSubmitManually">
          <AppCheckBox
            v-model:checked="submitManually"
            label="Schedule manually"
            name="submit-manually"
            data-bs-toggle="tooltip"
            data-bs-trigger="hover"
            data-bs-placement="bottom"
            data-bs-custom-class="wide-xxl-tooltip"
            data-bs-title="Transaction will have to be submitted to the network manually."
          />
        </div>

        <div
          v-if="
            !($route.query.group === 'true') && isLoggedInOrganization(user.selectedOrganization)
          "
        >
          <AppCheckBox
            v-model:checked="showAddReminder"
            label="Add reminder"
            name="add-reminder"
          />
        </div>
      </div>
      <template v-if="!($route.query.group === 'true')">
        <div class="flex-centered justify-content-end flex-wrap gap-3">
          <SaveDraftButton
            v-if="props.saveDraft && typeof isProcessed === 'boolean'"
            :description="description || ''"
            :is-executed="isProcessed"
            :save-draft="props.saveDraft"
          />
          <AppButton
            color="primary"
            type="submit"
            :loading="loading"
            :disabled="createButtonDisabled"
            data-testid="button-header-create"
            log-label="submit-transaction"
            :log-metadata="{
              action: createButtonLabel,
              transactionType: headingText,
              organization: isLoggedInOrganization(user.selectedOrganization),
            }"
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
            {{ $route.params.seq ? 'Save Group Item' : 'Add to Group' }}
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
