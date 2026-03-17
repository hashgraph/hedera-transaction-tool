<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup.ts';

import { useRoute } from 'vue-router';

import useAccountId from '@renderer/composables/useAccountId';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import * as claim from '@renderer/services/claimService';

import { isUserLoggedIn, stringifyHbar } from '@renderer/utils';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';
import { ToastManager } from '@renderer/utils/ToastManager.ts';

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
const transactionGroup = useTransactionGroupStore();

/* Composables */
const route = useRoute();
const account = useAccountId();
const { dateTimeSettingLabel } = useDateTimeSetting();
const toastManager = ToastManager.inject();

/* State */
const localValidStart = ref<Date>(props.validStart);

/* Computed */
const isGroupItem = computed(
  () => route.query.group === 'true' || route.query.groupIndex != null,
);

/* Handlers */
const handlePayerChange = (payerId: string) => {
  emit('update:payerId', payerId || '');
  account.accountId.value = payerId || '';
};

function handleUpdateValidStart(v: Date) {
  if (!isGroupItem.value || v.getTime() >= transactionGroup.groupValidStart.getTime()) {
    emit('update:validStart', v);
  } else {
    toastManager.warning('Valid Start date of transaction cannot be before Group Valid Start date');
  }
}

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal) || route.query.draftId || route.query.groupIndex) return;

  const [maxTransactionFeeClaim] = await claim.get({
    where: { user_id: user.personal.id, claim_key: DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY },
  });

  if (maxTransactionFeeClaim !== undefined) {
    emit(
      'update:maxTransactionFee',
      Hbar.fromString(maxTransactionFeeClaim.claim_value, HbarUnit.Tinybar),
    );
  }

  const allAccounts = user.publicKeyToAccounts.map(a => a.accounts).flat();
  if (allAccounts.length > 0 && allAccounts[0].account) {
    account.accountId.value = allAccounts[0].account;
    emit('update:payerId', allAccounts[0].account || '');
  }
});

/* Watchers */
watch(
  () => props.validStart,
  newValidStart => {
    localValidStart.value = newValidStart;
  },
);

watch(
  () => props.payerId,
  () => {
    account.accountId.value = props.payerId;
  },
);

watch(
  () => user.publicKeyToAccounts,
  () => {
    handlePayerChange(user.publicKeysToAccountsFlattened[0]);
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
      <label class="d-block form-label text-secondary"
        >Balance:
        {{
          account.isValid.value
            ? stringifyHbar((account.accountInfo.value?.balance as Hbar) || new Hbar(0))
            : '-'
        }}</label
      >
        <AccountIdInput
          :modelValue="payerId"
          @update:modelValue="handlePayerChange"
          :filled="true"
          placeholder="Enter Payer ID"
          data-testid="input-payer-account"
        />
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Valid Start
        <span class="text-muted text-italic">{{ `- ${dateTimeSettingLabel}` }}</span></label
      >
      <RunningClockDatePicker
        :model-value="validStart"
        @update:model-value="handleUpdateValidStart"
        :now-button-visible="true"
        data-testid="date-picker-valid-start"
      />
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Transaction Fee {{ HbarUnit.Hbar._symbol }}</label>
      <AppHbarInput
        :model-value="maxTransactionFee"
        @update:model-value="v => $emit('update:maxTransactionFee', v)"
        :filled="true"
        placeholder="Enter Max Transaction Fee"
        data-testid="input-max-transaction-fee"
      />
    </div>
  </div>
</template>
