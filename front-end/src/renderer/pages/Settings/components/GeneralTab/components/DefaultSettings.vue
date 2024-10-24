<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { add, get, update } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

/* Stores */
const user = useUserStore();

/* State */
const maxTransactionFee = ref<Hbar>(new Hbar(0));

const handleUpdateMaxTransactionFee = async (newFee: Hbar) => {
  if (!isUserLoggedIn(user.personal)) return;

  const storedClaim = await getStoredClaim(DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY);
  const addOrUpdate = storedClaim !== undefined ? update : add;

  await addOrUpdate(
    user.personal.id,
    DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
    newFee.toString(HbarUnit.Tinybar),
  );

  maxTransactionFee.value = newFee;
};

/* Functions */
const getStoredClaim = async (claimKey: string) => {
  if (!isUserLoggedIn(user.personal)) return;

  const [claim] = await get({
    where: {
      user_id: user.personal.id,
      claim_key: claimKey,
    },
  });

  return claim;
};

/* Hooks */
onBeforeMount(async () => {
  const storeMaxTransactionFee = await getStoredClaim(DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY);

  if (storeMaxTransactionFee !== undefined) {
    maxTransactionFee.value = Hbar.fromString(storeMaxTransactionFee.claim_value, HbarUnit.Tinybar);
  } else {
    maxTransactionFee.value = new Hbar(2);
    await handleUpdateMaxTransactionFee(new Hbar(2));
  }
});
</script>
<template>
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>Default Settings</p>
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
  </div>
</template>
