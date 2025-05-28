<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import type { ITransactionFull } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref, watch, watchEffect } from 'vue';

import {
  AccountCreateTransaction,
  Transaction,
  KeyList,
  PublicKey,
  AccountUpdateTransaction,
} from '@hashgraph/sdk';

import { TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';
import { add, getAll } from '@renderer/services/accountsService';

import {
  isUserLoggedIn,
  isAccountId,
  stringifyHbar,
  safeAwait,
  getAccountNicknameFromId,
  getAccountIdWithChecksum,
  formatPublickey,
  extractIdentifier,
} from '@renderer/utils';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();

/* State */
const isKeyStructureModalShown = ref(false);
const controller = ref<AbortController | null>(null);
const entityId = ref<string | null>(null);
const accounts = ref<HederaAccount[]>([]);
const newAccNickname = ref<string | null>(null);
const txNickname = ref<string | null>(null);
const formattedKey = ref('');

/* Handlers */
const handleLinkEntity = async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User not logged in');
  if (!entityId.value) throw new Error('Entity ID not available');

  await add(user.personal.id, entityId.value, network.network);

  accounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });

  toast.success(`Account ${entityId.value} linked`);
};

/* Functions */
async function fetchTransactionInfo(payer: string, seconds: string, nanos: string) {
  const { data } = await safeAwait(
    getTransactionInfo(
      `${payer}-${seconds}-${nanos}`,
      network.mirrorNodeBaseURL,
      controller.value || undefined,
    ),
  );

  if (data && data.transactions.length > 0) {
    entityId.value = data.transactions[0].entity_id || null;
  }
}

async function checkAndFetchTransactionInfo() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User not logged in');

  const isExecutedOrganizationTransaction = Boolean(
    props.organizationTransaction?.status &&
      [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
        props.organizationTransaction.status,
      ),
  );

  if (
    (isExecutedOrganizationTransaction || !props.organizationTransaction) &&
    props.transaction instanceof AccountCreateTransaction
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

    accounts.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
}

/* Hooks */
onBeforeMount(async () => {
  if (
    !(
      props.transaction instanceof AccountCreateTransaction ||
      props.transaction instanceof AccountUpdateTransaction
    )
  ) {
    throw new Error('Transaction is not Account Create or Update Transaction');
  }

  await checkAndFetchTransactionInfo();
  if (props.transaction.key && props.transaction.key instanceof PublicKey && true) {
    formattedKey.value = await formatPublickey(props.transaction.key.toStringRaw());
  }
});

onBeforeUnmount(() => {
  controller.value?.abort();
});

/* Watchers */
watch([() => props.transaction, () => props.organizationTransaction], async () => {
  setTimeout(async () => await checkAndFetchTransactionInfo(), 3000);
});

watchEffect(async () => {
  if (entityId.value) {
    newAccNickname.value = await getAccountNicknameFromId(entityId.value);
  }
});

watchEffect(async () => {
  if (props.transaction) {
    const tx = props.transaction as AccountUpdateTransaction;
    if (tx.accountId) {
      const txNick = await getAccountNicknameFromId(tx.accountId.toString());
      txNickname.value = txNick;
    }
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
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
      <p :class="detailItemValueClass" data-testid="p-account-details-id">
        <span v-if="txNickname">
          {{ `${txNickname} (${getAccountIdWithChecksum(transaction.accountId.toString())})` }}
        </span>
        <span v-else>{{ getAccountIdWithChecksum(transaction.accountId.toString()) }}</span>
      </p>
    </div>
    <div v-if="transaction instanceof AccountCreateTransaction && entityId" class="col-12 mb-3">
      <div class="flex-centered justify-content-start gap-4">
        <div>
          <h4 :class="detailItemLabelClass">New Account ID</h4>
          <p :class="detailItemValueClass" data-testid="p-new-account-id">
            <span v-if="newAccNickname">
              {{ `${newAccNickname} (${getAccountIdWithChecksum(entityId)})` }}
            </span>
            <span v-else>{{ getAccountIdWithChecksum(entityId) }}</span>
          </p>
        </div>
        <div>
          <AppButton
            v-if="!accounts.some(f => f.account_id === entityId)"
            class="min-w-unset"
            color="secondary"
            size="small"
            type="button"
            @click="handleLinkEntity"
            >Link Account</AppButton
          >
          <span
            v-if="accounts.some(f => f.account_id === entityId)"
            class="align-self-start text-small text-secondary"
            >Account already linked</span
          >
        </div>
      </div>
    </div>

    <!-- Key -->
    <div
      v-if="transaction.key"
      class="col-12 my-3"
      :class="{ 'mt-3': transaction instanceof AccountUpdateTransaction && transaction.accountId }"
    >
      <h4 :class="detailItemLabelClass">Key</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-key">
        <template v-if="transaction.key instanceof KeyList && true">
          <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
            >See details</span
          >
        </template>
        <template v-else-if="transaction.key instanceof PublicKey && true && formattedKey">
          <p class="overflow-hidden">
            <span class="text-semi-bold" :class="{ 'text-pink': !extractIdentifier(formattedKey) }">
              {{ transaction.key._key._type }}
            </span>
            <span v-if="extractIdentifier(formattedKey)" class="d-flex flex-row flex-wrap gap-2">
              <span class="text-small text-pink">{{
                extractIdentifier(formattedKey)?.identifier
              }}</span>
              <span class="text-secondary text-small">{{
                `(${extractIdentifier(formattedKey)?.pk})`
              }}</span>
            </span>
            <span v-else>{{ formattedKey }}</span>
          </p>
        </template>
        <template v-else>None</template>
      </p>
    </div>

    <!-- Memo -->
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        (transaction.accountMemo !== null && transaction.accountMemo.trim().length > 0)
      "
      class="col-12 my-3"
    >
      <h4 :class="detailItemLabelClass">Memo</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-memo">
        {{ transaction.accountMemo }}
      </p>
    </div>

    <!-- Staking -->
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        transaction.stakedNodeId !== null ||
        transaction.stakedAccountId !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Staking</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-staking">
        {{
          transaction.stakedAccountId && transaction.stakedAccountId.toString() !== '0.0.0'
            ? `Account ${transaction.stakedAccountId.toString()}`
            : transaction.stakedNodeId && isAccountId(transaction.stakedNodeId.toString())
              ? `Node ${transaction.stakedNodeId.toString()}`
              : transaction instanceof AccountCreateTransaction
                ? 'None'
                : 'Unstaked'
        }}
      </p>
    </div>

    <!-- Decline staking rewards - Displayed in reverse -->
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        transaction.declineStakingRewards !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Accept Staking Rewards</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-accept-rewards">
        {{ transaction.declineStakingRewards ? 'No' : 'Yes' }}
      </p>
    </div>

    <!-- Receiver signature required -->
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        transaction.receiverSignatureRequired !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Receiver Signature Required</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-receiver-sig-required">
        {{ transaction.receiverSignatureRequired ? 'Yes' : 'No' }}
      </p>
    </div>

    <!-- Initial balance -->
    <div
      v-if="transaction instanceof AccountCreateTransaction && transaction.initialBalance"
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Initial balance</h4>
      <p :class="detailItemValueClass" data-testid="p-account-details-init-balance">
        {{ stringifyHbar(transaction.initialBalance) }}
      </p>
    </div>

    <!-- Max automatic token associations -->
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        transaction.maxAutomaticTokenAssociations !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Max Automatic Token Associations</h4>
      <p :class="detailItemValueClass">
        {{ transaction.maxAutomaticTokenAssociations }}
      </p>
    </div>

    <KeyStructureModal v-model:show="isKeyStructureModalShown" :account-key="transaction.key" />
  </div>
</template>
