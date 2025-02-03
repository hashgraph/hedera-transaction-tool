<script setup lang="ts">
import type { ITransactionFull, IUserLinkedAccounts } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref, watch, watchEffect } from 'vue';
import { Transaction, AccountDeleteTransaction, Hbar, HbarUnit } from '@hashgraph/sdk';

import { TransactionStatus } from '@main/shared/interfaces';

import useNetworkStore from '@renderer/stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';

import { getAccountNicknameFromId, safeAwait, stringifyHbar } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
  allLinkedAccounts?: IUserLinkedAccounts[];
}>();

/* Stores */
const network = useNetworkStore();

/* State */
const controller = ref<AbortController | null>(null);
const transferredAmount = ref<Hbar | undefined>(new Hbar(0));
const nicknames = ref<{ deletedNickname: string; transferedToNickname: string } | undefined>(
  undefined,
);

/* Composables */
const accountData = useAccountId();

/* Functions */
async function fetchTransactionInfo(payer: string, seconds: string, nanos: string) {
  const { data } = await safeAwait(
    getTransactionInfo(
      `${payer}-${seconds}-${nanos}`,
      network.mirrorNodeBaseURL,
      controller.value || undefined,
    ),
  );

  if (data) {
    if (data.transactions.length > 0 && props.transaction instanceof AccountDeleteTransaction) {
      const deletedAccountId = props.transaction.accountId?.toString();
      const amount =
        data.transactions[0].transfers?.find(
          transfer => transfer.account?.toString() === deletedAccountId,
        )?.amount || 0;
      transferredAmount.value = Hbar.from(Math.abs(amount), HbarUnit.Tinybar);
    }
  }
}

async function checkAndFetchTransactionInfo() {
  const isExecutedOrganizationTransaction = Boolean(
    props.organizationTransaction?.status &&
      [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
        props.organizationTransaction.status,
      ),
  );

  if (
    (isExecutedOrganizationTransaction || !props.organizationTransaction) &&
    props.transaction instanceof AccountDeleteTransaction
  ) {
    controller.value = new AbortController();

    const payer = props.transaction.transactionId?.accountId?.toString();
    const seconds = props.transaction.transactionId?.validStart?.seconds?.toString();
    const nanos = props.transaction.transactionId?.validStart?.nanos?.toString();

    if (payer && seconds && nanos) {
      if (!props.organizationTransaction) {
        setTimeout(async () => await fetchTransactionInfo(payer, seconds, nanos), 1500);
      } else {
        await fetchTransactionInfo(payer, seconds, nanos);
      }
    }
  }
}

/* Hooks */
onBeforeMount(async () => {
  if (!(props.transaction instanceof AccountDeleteTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }

  await checkAndFetchTransactionInfo();
});

onBeforeUnmount(() => {
  controller.value?.abort();
});

/* Watchers */
watch([() => props.transaction, () => props.organizationTransaction], async () => {
  setTimeout(async () => await checkAndFetchTransactionInfo(), 3000);
});

watchEffect(() => {
  if (props.transaction && props.allLinkedAccounts && props.allLinkedAccounts.length > 0) {
    const tx = props.transaction as AccountDeleteTransaction;
    if (tx.accountId && tx.transferAccountId) {
      const [deletedNick, transferedToNick] = [
        getAccountNicknameFromId(tx.accountId.toString(), props.allLinkedAccounts),
        getAccountNicknameFromId(tx.transferAccountId.toString(), props.allLinkedAccounts),
      ];

      nicknames.value = { deletedNickname: deletedNick, transferedToNickname: transferedToNick };
    }
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div v-if="transaction instanceof AccountDeleteTransaction && true" class="mt-5 row flex-wrap">
    <!-- Account ID -->
    <div v-if="transaction.accountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Account ID</h4>
      <p :class="detailItemValueClass" data-testid="p-account-delete-details-account-id">
        <span v-if="nicknames?.deletedNickname">
          {{
            `${nicknames.deletedNickname} (${accountData.getAccountIdWithChecksum(transaction.accountId.toString())})`
          }}
        </span>
        <span v-else>
          {{
            accountData.getAccountIdWithChecksum(transaction.accountId.toString()) ||
            transaction.accountId.toString()
          }}
        </span>
      </p>
    </div>

    <!-- Transfer account ID -->
    <div v-if="transaction.transferAccountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Transfer Account ID</h4>
      <p :class="detailItemValueClass" data-testid="p-account-delete-details-transfer-account-id">
        <span v-if="nicknames?.transferedToNickname">
          {{
            `${nicknames.transferedToNickname} (${accountData.getAccountIdWithChecksum(transaction.transferAccountId.toString())})`
          }}
        </span>
        <span v-else>
          {{
            accountData.getAccountIdWithChecksum(transaction.transferAccountId.toString()) ||
            transaction.transferAccountId.toString()
          }}
        </span>
      </p>
    </div>

    <!-- Transfered amount -->
    <div v-if="transferredAmount?.toBigNumber().gt(0)" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Transferred Amount</h4>
      <p :class="detailItemValueClass" data-testid="p-account-delete-details-transfer-amount">
        {{ stringifyHbar((transferredAmount as Hbar) || new Hbar(0)) }}
      </p>
    </div>
  </div>
</template>
