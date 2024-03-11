<script setup lang="ts">
import { onMounted } from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { getDraft } from '@renderer/services/transactionDraftsService';
import { getTransactionFromBytes } from '@renderer/utils/transactions';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';

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
const user = useUserStore();

/* Composables */
const route = useRoute();
const account = useAccountId();

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
    emit('update:maxTransactionFee', draftTransaction.maxTransactionFee.toBigNumber().toNumber());
  }
};

/* Hooks */
onMounted(async () => {
  if (route.query.draftId) {
    await loadFromDraft(route.query.draftId.toString());
  } else {
    const allAccounts = keyPairs.publicKeyToAccounts.map(a => a.accounts).flat();
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
        >Balance: {{ account.accountInfo.value?.balance || 0 }}</label
      >
      <template v-if="user.data.mode === 'personal'">
        <AccountIdsSelect :account-id="payerId" @update:account-id="handlePayerChange" />
      </template>
      <template v-else>
        <AppInput
          :model-value="account.isValid.value ? account.accountIdFormatted.value : payerId"
          @update:model-value="
            v => {
              $emit('update:payerId', v);
              account.accountId.value = v;
            }
          "
          :filled="true"
          placeholder="Enter Payer ID"
        />
      </template>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Valid Start Time</label>
      <AppInput
        :model-value="validStart"
        @update:model-value="v => $emit('update:validStart', v)"
        :filled="true"
        type="datetime-local"
        step="1"
      />
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Transaction Fee</label>
      <AppInput
        :model-value="maxTransactionFee"
        @update:model-value="v => $emit('update:maxTransactionFee', Number(v))"
        :filled="true"
        type="number"
        min="0"
      />
    </div>
  </div>
</template>
