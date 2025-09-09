<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import useAccountId from '@renderer/composables/useAccountId';

import * as claim from '@renderer/services/claimService';

import { isUserLoggedIn, stringifyHbar } from '@renderer/utils';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';

/* Props */
const props = defineProps<{
  payerId: string;
  validStart: Date;
  maxTransactionFee: Hbar;
}>();

/* Emits */
const emit = defineEmits([
  'update:payerId',
  'update:validStart',
  'update:maxTransactionFee',
  'userEdit',
]);

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();
const account = useAccountId();

/* State */
const localValidStart = ref<Date>(props.validStart);

/* Handlers */
const handlePayerChange = (payerId: string) => {
  emit('update:payerId', payerId || '');
  account.accountId.value = payerId || '';
  emit('userEdit');
};

function handleUpdateValidStart(v: Date) {
  emit('update:validStart', v);
}

function handleUpdateMaxTransactionFee(v: Hbar) {
  emit('update:maxTransactionFee', v);
  emit('userEdit');
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
      <template v-if="!user.selectedOrganization">
        <AccountIdsSelect
          :account-id="payerId || ''"
          @update:account-id="handlePayerChange"
          :select-default="true"
        />
      </template>
      <template v-else>
        <AccountIdInput
          :modelValue="payerId"
          @update:modelValue="handlePayerChange"
          :filled="true"
          placeholder="Enter Payer ID"
          data-testid="dropdown-payer"
        />
      </template>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Valid Start <span class="text-muted text-italic">- Local time</span></label
      >
      <RunningClockDatePicker
        :model-value="validStart"
        @update:model-value="handleUpdateValidStart"
        @user-edit="emit('userEdit')"
        :now-button-visible="true"
        data-testid="date-picker-valid-start"
      />
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Transaction Fee {{ HbarUnit.Hbar._symbol }}</label>
      <AppHbarInput
        :model-value="maxTransactionFee"
        @update:model-value="handleUpdateMaxTransactionFee"
        :filled="true"
        placeholder="Enter Max Transaction Fee"
        data-testid="input-max-transaction-fee"
      />
    </div>
  </div>
</template>
