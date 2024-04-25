<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { getDraft } from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes, stringifyHbar } from '@renderer/utils';

import DatePicker from '@vuepic/vue-datepicker';
import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
defineProps<{
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

/* Computed */
const accoundIds = computed<string[]>(() =>
  user.publicKeyToAccounts
    .map(a => a.accounts)
    .flat()
    .filter(acc => !acc.deleted && acc.account !== null)
    .map(acc => acc.account || '')
    .filter(acc => acc !== null),
);

/* Handlers */
const handlePayerChange = payerId => {
  account.accountId.value = payerId;
  emit('update:payerId', payerId);
};

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
  }

  if (draftTransaction.maxTransactionFee) {
    emit('update:maxTransactionFee', draftTransaction.maxTransactionFee);
  }
};

/* Hooks */
onMounted(async () => {
  if (route.query.draftId) {
    await loadFromDraft(route.query.draftId.toString());
  } else {
    const allAccounts = user.publicKeyToAccounts.map(a => a.accounts).flat();
    if (allAccounts.length > 0 && allAccounts[0].account) {
      account.accountId.value = allAccounts[0].account;
      emit('update:payerId', allAccounts[0].account);
    }
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row flex-wrap align-items-end">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Payer ID <span class="text-danger">*</span></label>
      <label v-if="account.isValid.value" class="d-block form-label text-secondary"
        >Balance:
        {{ stringifyHbar((account.accountInfo.value?.balance as Hbar) || new Hbar(0)) }}</label
      >
      <template v-if="!user.selectedOrganization">
        <AccountIdsSelect :account-id="payerId" @update:account-id="handlePayerChange" />
      </template>
      <template v-else>
        <div class="position-relative">
          <AppAutoComplete
            :model-value="account.isValid.value ? account.accountIdFormatted.value : payerId"
            @update:model-value="
              v => {
                $emit('update:payerId', v);
                account.accountId.value = v;
              }
            "
            :filled="true"
            :items="accoundIds"
            placeholder="Enter Payer ID"
          />
        </div>
      </template>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Valid Start Time</label>
      <DatePicker
        :model-value="validStart"
        @update:model-value="v => $emit('update:validStart', v)"
        :clearable="false"
        :auto-apply="true"
        :config="{
          keepActionRow: true,
        }"
        :min-date="new Date()"
        class="is-fill"
        menu-class-name="is-fill"
        calendar-class-name="is-fill"
        input-class-name="is-fill"
        calendar-cell-class-name="is-fill"
      >
        <template #action-row>
          <div class="d-grid w-100">
            <AppButton
              color="secondary"
              size="small"
              type="button"
              @click="$emit('update:validStart', new Date())"
            >
              Now
            </AppButton>
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
