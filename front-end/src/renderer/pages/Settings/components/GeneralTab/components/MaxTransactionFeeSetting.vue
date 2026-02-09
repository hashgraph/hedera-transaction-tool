<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { getStoredClaim, setStoredClaim } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

/* Stores */
const user = useUserStore();

/* State */
const maxTransactionFee = ref<Hbar>(new Hbar(0));

const handleUpdateMaxTransactionFee = async (newFee: Hbar) => {
  if (!isUserLoggedIn(user.personal)) return;

  await setStoredClaim(
    user.personal.id,
    DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
    newFee.toString(HbarUnit.Tinybar),
  );

  maxTransactionFee.value = newFee;
};

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    const storeMaxTransactionFee = await getStoredClaim(
      user.personal.id,
      DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
    );

    if (storeMaxTransactionFee !== undefined) {
      maxTransactionFee.value = Hbar.fromString(storeMaxTransactionFee, HbarUnit.Tinybar);
    } else {
      maxTransactionFee.value = new Hbar(2);
      await handleUpdateMaxTransactionFee(new Hbar(2));
    }
  }
});
</script>
<template>
  <div class="mt-4">
    <div class="col-sm-5 col-lg-4">
      <label class="form-label me-3">Max Transaction Fee {{ HbarUnit.Hbar._symbol }}</label>
      <AppHbarInput
        :model-value="maxTransactionFee as Hbar"
        @update:model-value="handleUpdateMaxTransactionFee"
        placeholder="Enter Amount in Hbar"
        :filled="true"
        data-testid="input-default-max-transaction-fee"
      />
    </div>
  </div>
</template>
