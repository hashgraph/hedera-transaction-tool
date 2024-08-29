<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import useAccountId from '@renderer/composables/useAccountId';

import { getDraft } from '@renderer/services/transactionDraftsService';

import { formatAccountId, getTransactionFromBytes, stringifyHbar } from '@renderer/utils';
import { flattenAccountIds } from '@renderer/utils/userStoreHelpers';

import DatePicker, { DatePickerInstance } from '@vuepic/vue-datepicker';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  payerId: string;
  validStart: Date;
  maxTransactionFee: Hbar;
}>();

/* Emits */
const emit = defineEmits(['update:payerId', 'update:validStart', 'update:maxTransactionFee']);

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();
const account = useAccountId();

/* State */
const localValidStart = ref<Date>(props.validStart);
const datePicker = ref<DatePickerInstance>(null);
const intervalId = ref<ReturnType<typeof setInterval> | null>(null);

/* Computed */
const accoundIds = computed<string[]>(() => flattenAccountIds(user.publicKeyToAccounts));

/* Handlers */
const handlePayerSelect = payerId => {
  account.accountId.value = payerId;
  emit('update:payerId', payerId || '');
};

const handlePayerChange = payerId => {
  emit('update:payerId', formatAccountId(payerId));
  account.accountId.value = formatAccountId(payerId);
};

function handleUpdateValidStart(v: Date) {
  emit('update:validStart', v);
}

/* Functions */
const loadFromDraft = async (id: string) => {
  const draft = await getDraft(id.toString());
  const draftTransaction = getTransactionFromBytes(draft.transactionBytes);

  if (draftTransaction.transactionId) {
    const transactionId = draftTransaction.transactionId;

    if (transactionId.accountId) {
      account.accountId.value = transactionId.accountId.toString();
      emit('update:payerId', transactionId.accountId.toString());
    }

    if (transactionId.validStart) {
      emit('update:validStart', transactionId.validStart.toDate());
    }
  }

  if (draftTransaction.maxTransactionFee) {
    emit('update:maxTransactionFee', draftTransaction.maxTransactionFee);
  }
};

function startInterval() {
  intervalId.value = setInterval(() => {
    const now = new Date();
    if (localValidStart.value < now) {
      emit('update:validStart', now);
    }
  }, 1000);
}

function stopInterval() {
  intervalId.value && clearInterval(intervalId.value);
}

/* Hooks */
onMounted(async () => {
  if (route.query.draftId) {
    await loadFromDraft(route.query.draftId.toString());
  } else {
    const allAccounts = user.publicKeyToAccounts.map(a => a.accounts).flat();
    if (allAccounts.length > 0 && allAccounts[0].account) {
      account.accountId.value = allAccounts[0].account;
      emit('update:payerId', allAccounts[0].account || '');
    }
  }

  startInterval();
});

onUnmounted(() => {
  stopInterval();
});

/* Watchers */
watch(
  () => props.validStart,
  newValidStart => {
    localValidStart.value = newValidStart;
  },
);

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row flex-wrap align-items-end">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Payer ID <span class="text-danger">*</span></label>
      <label v-if="account.accountInfo.value?.deleted" class="d-block form-label text-danger me-3"
        ><span class="bi bi-exclamation-triangle-fill me-1"></span> Account is deleted</label
      >
      <label v-else-if="account.isValid.value" class="d-block form-label text-secondary"
        >Balance:
        {{ stringifyHbar((account.accountInfo.value?.balance as Hbar) || new Hbar(0)) }}</label
      >
      <template v-if="!user.selectedOrganization">
        <AccountIdsSelect
          :account-id="payerId || ''"
          @update:account-id="handlePayerSelect"
          :select-default="true"
        />
      </template>
      <template v-else>
        <div class="position-relative">
          <AppAutoComplete
            :model-value="account.isValid.value ? account.accountIdFormatted.value : payerId"
            @update:model-value="handlePayerChange"
            :filled="true"
            :items="accoundIds"
            data-testid='dropdown-payer'
            placeholder="Enter Payer ID"
          />
        </div>
      </template>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Valid Start <span class="text-muted text-italic">- Local time</span></label
      >
      <DatePicker
        ref="datePicker"
        data-testid="date-picker-valid-start"
        :model-value="validStart"
        @update:model-value="handleUpdateValidStart"
        :clearable="false"
        :auto-apply="true"
        :config="{
          keepActionRow: true,
        }"
        :min-date="new Date()"
        enable-seconds
        :teleport="true"
        class="is-fill"
        menu-class-name="is-fill"
        calendar-class-name="is-fill"
        input-class-name="is-fill"
        calendar-cell-class-name="is-fill"
      >
        <template #action-row>
          <div class="d-flex justify-content-end gap-4 w-100">
            <AppButton
              class="min-w-unset"
              size="small"
              type="button"
              @click="$emit('update:validStart', new Date())"
            >
              Now
            </AppButton>
            <AppButton
              class="min-w-unset"
              color="secondary"
              size="small"
              type="button"
              @click="datePicker?.closeMenu()"
              >Close</AppButton
            >
          </div>
        </template>
      </DatePicker>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Transaction Fee {{ HbarUnit.Hbar._symbol }}</label>
      <AppHbarInput
        :model-value="maxTransactionFee"
        @update:model-value="v => $emit('update:maxTransactionFee', v)"
        :filled="true"
        placeholder="Enter Max Transaction Fee"
      />
    </div>
  </div>
</template>
