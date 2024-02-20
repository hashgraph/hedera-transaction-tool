<script setup lang="ts">
import {onMounted} from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import {useRoute} from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import {getDraft} from '@renderer/services/transactionDraftsService';
import {getDateTimeLocalInputValue} from '@renderer/utils';
import {getTransactionFromBytes} from '@renderer/utils/transactions';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
defineProps<{
  payerId: string;
  validStart: string;
  maxTransactionFee: number;
}>();

/* Emits */
const emit = defineEmits(['update:payerId', 'update:validStart', 'update:maxTransactionFee']);

/* Stores */
const keyPairs = useKeyPairsStore();

/* Composables */
const route = useRoute();
const account = useAccountId();

/* Functions */
const loadFromDraft = async (id: string) => {
  const draft = await getDraft(id.toString());
  const draftTransaction = getTransactionFromBytes(draft.transactionBytes);

  if (draftTransaction.transactionId) {
    const transactionId = draftTransaction.transactionId;

    if (transactionId.accountId) {
      emit('update:payerId', transactionId.accountId.toString());
    }
    if (transactionId.validStart) {
      emit('update:validStart', getDateTimeLocalInputValue(transactionId.validStart.toDate()));
    }
  }

  if (draftTransaction.maxTransactionFee) {
    emit('update:maxTransactionFee', draftTransaction.maxTransactionFee.toBigNumber().toNumber());
  }
};

/* Hooks */
onMounted(async () => {
  if (route.query.draftId) {
    await loadFromDraft(route.query.draftId.toString());
  } else {
    const allAccountIds = keyPairs.accoundIds.map(a => a.accountIds).flat();
    if (allAccountIds.length > 0) {
      account.accountId.value = allAccountIds[0];
      emit('update:payerId', allAccountIds[0]);
    }
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row flex-wrap align-items-end">
    <div
      class="form-group"
      :class="[columnClass]"
    >
      <label class="form-label">Payer ID <span class="text-danger">*</span></label>
      <label
        v-if="account.isValid.value"
        class="d-block form-label text-secondary"
        >Balance: {{ account.accountInfo.value?.balance || 0 }}</label
      >
      <AppInput
        :model-value="account.isValid.value ? account.accountIdFormatted.value : payerId"
        :filled="true"
        placeholder="Enter Payer ID"
        @update:model-value="
          v => {
            $emit('update:payerId', v);
            account.accountId.value = v;
          }
        "
      />
    </div>
    <div
      class="form-group"
      :class="[columnClass]"
    >
      <label class="form-label">Valid Start Time</label>
      <AppInput
        :model-value="validStart"
        :filled="true"
        type="datetime-local"
        step="1"
        @update:model-value="v => $emit('update:validStart', v)"
      />
    </div>
    <div
      class="form-group"
      :class="[columnClass]"
    >
      <label class="form-label">Max Transaction Fee</label>
      <AppInput
        :model-value="maxTransactionFee"
        :filled="true"
        type="number"
        min="0"
        @update:model-value="v => $emit('update:maxTransactionFee', Number(v))"
      />
    </div>
  </div>
</template>
