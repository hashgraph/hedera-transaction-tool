<script setup lang="ts">
import { onBeforeMount, watch } from 'vue';
import { Hbar, HbarUnit } from '@hiero-ledger/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import useAccountId from '@renderer/composables/useAccountId';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import * as claim from '@renderer/services/claimService';

import { isUserLoggedIn, stringifyHbar } from '@renderer/utils';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';

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
const { dateTimeSettingLabel } = useDateTimeSetting();

/* Handlers */
const handlePayerChange = (payerId: string) => {
  emit('update:payerId', payerId || '');
  account.accountId.value = payerId || '';
};

function handleUpdateValidStart(v: Date) {
  emit('update:validStart', v);
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
  <div class="row flex-wrap align-items-start">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Payer ID <span class="text-danger">*</span></label>
      <AccountIdInput
        :modelValue="payerId"
        @update:modelValue="handlePayerChange"
        :filled="true"
        placeholder="Enter Payer ID"
        data-testid="input-payer-account"
      />
      <div class="text-micro mt-2">
        <span v-if="account.isLoading.value" class="invisible">Loading…</span>
        <span
          v-else-if="account.accountInfo.value === null"
          class="text-warning bi bi-exclamation-triangle-fill me-1"
        >
          Account does not exist
        </span>
        <span
          v-else-if="account.accountInfo.value?.deleted"
          class="text-warning bi bi-exclamation-triangle-fill me-1"
        >
          Account is deleted
        </span>
        <span v-else class="text-muted">
          Balance:
          {{
            account.isValid.value
              ? stringifyHbar((account.accountInfo.value?.balance as Hbar) || new Hbar(0))
              : '-'
          }}
        </span>
      </div>
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
