<script setup lang="ts">
import { onBeforeMount } from 'vue';

import { Transaction, AccountAllowanceApproveTransaction, Hbar } from '@hashgraph/sdk';

import { stringifyHbar } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Hooks */
onBeforeMount(() => {
  if (!(props.transaction instanceof AccountAllowanceApproveTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }
});

/* Misc */
const approvalHeadingClass = 'text-subheader text-dark-blue mt-5';
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div v-if="transaction instanceof AccountAllowanceApproveTransaction && true" class="mt-5">
    <h3 v-if="transaction.hbarApprovals.length > 0" :class="approvalHeadingClass">
      Hbar approvals
    </h3>
    <template
      v-for="(approval, i) in transaction.hbarApprovals"
      :key="`${i}${approval.ownerAccountId?.toString()}${approval.spenderAccountId?.toString()}${stringifyHbar(approval.amount || Hbar.fromString('0'))}`"
    >
      <div class="row flex-wrap my-3" :class="{ 'mt-0': i === 0 }">
        <div v-if="approval.ownerAccountId" :class="commonColClass">
          <h4 :class="detailItemLabelClass">Owner ID</h4>
          <p :class="detailItemValueClass" data-testid="p-account-approve-details-owner-id">
            {{ approval.ownerAccountId?.toString() }}
          </p>
        </div>
        <div v-if="approval.spenderAccountId" :class="commonColClass">
          <h4 :class="detailItemLabelClass">Spender ID</h4>
          <p :class="detailItemValueClass" data-testid="p-account-approve-details-spender-id">
            {{ approval.spenderAccountId?.toString() }}
          </p>
        </div>
        <div :class="commonColClass">
          <h4 :class="detailItemLabelClass">Amount</h4>
          <p :class="detailItemValueClass" data-testid="p-account-approve-details-amount">
            {{ stringifyHbar(approval.amount || Hbar.fromString('0')) }}
          </p>
        </div>
      </div>
      <hr v-if="i !== transaction.hbarApprovals.length - 1" class="separator" />
    </template>
    <h3 v-if="transaction.tokenApprovals.length > 0" :class="approvalHeadingClass">
      Token approvals
    </h3>
    <template
      v-for="(approval, i) in transaction.tokenApprovals"
      :key="`${i}${approval.ownerAccountId?.toString()}${approval.spenderAccountId?.toString()}${approval.tokenId.toString()}${stringifyHbar(approval.amount ? new Hbar(approval.amount) : Hbar.fromString('0'))}`"
    >
      <div class="row flex-wrap my-3" :class="{ 'mt-0': i === 0 }">
        <div v-if="approval.ownerAccountId" :class="commonColClass">
          <h4 :class="detailItemLabelClass">Owner ID</h4>
          <p :class="detailItemValueClass">{{ approval.ownerAccountId?.toString() }}</p>
        </div>
        <div v-if="approval.spenderAccountId" :class="commonColClass">
          <h4 :class="detailItemLabelClass">Spender ID</h4>
          <p :class="detailItemValueClass">{{ approval.spenderAccountId?.toString() }}</p>
        </div>
        <div v-if="approval.tokenId" :class="commonColClass">
          <h4 :class="detailItemLabelClass">Token ID</h4>
          <p :class="detailItemValueClass">{{ approval.tokenId?.toString() }}</p>
        </div>
        <div :class="commonColClass">
          <h4 :class="detailItemLabelClass">Amount</h4>
          <p :class="detailItemValueClass">
            {{ stringifyHbar(approval.amount ? new Hbar(approval.amount) : Hbar.fromString('0')) }}
          </p>
        </div>
      </div>
      <hr v-if="i !== transaction.hbarApprovals.length - 1" class="separator" />
    </template>
    <!-- TO IMPLEMENT TOKEN NFT APPROVALS IF NEEDED -->
    <h3 v-if="transaction.tokenApprovals.length > 0" :class="approvalHeadingClass">
      Token Nft approvals
    </h3>
  </div>
</template>
