<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import {
  AccountCreateTransaction,
  Transaction,
  KeyList,
  PublicKey,
  AccountUpdateTransaction,
} from '@hashgraph/sdk';

import { isAccountId, stringifyHbar } from '@renderer/utils';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* State */
const isKeyStructureModalShown = ref(false);

/* Hooks */
onBeforeMount(() => {
  if (
    !(
      props.transaction instanceof AccountCreateTransaction ||
      props.transaction instanceof AccountUpdateTransaction
    )
  ) {
    throw new Error('Transaction is not Account Create or Update Transaction');
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-md-5 col-lg-4 col-xl-3 my-3';
</script>
<template>
  <div
    v-if="
      transaction instanceof AccountCreateTransaction ||
      (transaction instanceof AccountUpdateTransaction && true)
    "
    class="mt-5 row flex-wrap"
  >
    <!-- Account ID -->
    <div
      v-if="transaction instanceof AccountUpdateTransaction && transaction.accountId"
      class="col-12 mb-3"
    >
      <h4 :class="detailItemLabelClass">Account ID</h4>
      <p :class="detailItemValueClass">
        {{ transaction.accountId.toString() }}
      </p>
    </div>

    <!-- Key -->
    <div
      class="col-12 mb-3"
      :class="{ 'mt-3': transaction instanceof AccountUpdateTransaction && transaction.accountId }"
    >
      <h4 :class="detailItemLabelClass">Key</h4>
      <p :class="detailItemValueClass">
        <template v-if="transaction.key instanceof KeyList && true">
          <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
            >See details</span
          >
        </template>
        <template v-else-if="transaction.key instanceof PublicKey && true">
          <p class="overflow-hidden">
            <span class="text-semi-bold text-pink">
              {{ transaction.key._key._type }}
            </span>
            {{ transaction.key.toStringRaw() }}
          </p>
        </template>
        <template v-else>None</template>
      </p>
    </div>

    <!-- Memo -->
    <div class="col-12 my-3">
      <h4 :class="detailItemLabelClass">Memo</h4>
      <p :class="detailItemValueClass">
        {{ transaction.accountMemo || 'sadasdasdas' }}
      </p>
    </div>

    <!-- Staking -->
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Staking</h4>
      <p :class="detailItemValueClass">
        {{
          transaction.stakedAccountId && transaction.stakedAccountId.toString() !== '0.0.0'
            ? `Account ${transaction.stakedAccountId.toString()}`
            : transaction.stakedNodeId && isAccountId(transaction.stakedNodeId.toString())
              ? `Node ${transaction.stakedNodeId.toString()}`
              : 'None'
        }}
      </p>
    </div>

    <!-- Decline staking rewards -->
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Decline Staking Rewards</h4>
      <p :class="detailItemValueClass">
        {{ transaction.declineStakingRewards ? 'Yes' : 'No' }}
      </p>
    </div>

    <!-- Receiver signature required -->
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Receiver Signature Required</h4>
      <p :class="detailItemValueClass">
        {{ transaction.receiverSignatureRequired ? 'Yes' : 'No' }}
      </p>
    </div>

    <!-- Initial balance -->
    <div
      v-if="transaction instanceof AccountCreateTransaction && transaction.initialBalance"
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Initial balance</h4>
      <p :class="detailItemValueClass">
        {{ stringifyHbar(transaction.initialBalance) }}
      </p>
    </div>

    <!-- Initial balance -->
    <div v-if="transaction.maxAutomaticTokenAssociations" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Max Automatic Token Associations</h4>
      <p :class="detailItemValueClass">
        {{ transaction.maxAutomaticTokenAssociations }}
      </p>
    </div>

    <KeyStructureModal v-model:show="isKeyStructureModalShown" :account-key="transaction.key" />
  </div>
</template>
