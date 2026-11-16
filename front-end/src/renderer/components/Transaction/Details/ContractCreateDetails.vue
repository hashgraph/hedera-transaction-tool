<script setup lang="ts">
import type { SmartContract } from '@prisma/client';
import { type ITransactionFull, TransactionStatus } from '@shared/interfaces';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ContractCreateTransaction, KeyList, PublicKey, Transaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/smartContractsService';
import { decodeConstructorParams } from '@renderer/utils/sdk/contractFunctionParams';
import { findMatchingSavedContract } from '@renderer/utils/sdk/contractCall';
import { parseStoredAbi, type AbiItem } from '@renderer/utils/sdk/abi';
import { AppCache } from '@renderer/caches/AppCache.ts';

import {
  isUserLoggedIn,
  stringifyHbar,
  uint8ToHex,
  safeAwait,
  formatPublicKey,
  extractIdentifier,
} from '@renderer/utils';

import KeyComponent from '@renderer/components/KeyComponent.vue';
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

/* Injected */
const appCache = AppCache.inject();
const transactionByIdCache = appCache.mirrorTransactionById;

/* State */
const savedContracts = ref<SmartContract[]>([]);
const entityId = ref<string | null>(null);
const formattedKey = ref('');
const isKeyStructureModalShown = ref(false);

// Bumped whenever the displayed transaction changes, so an entity-id lookup started for a
// previous transaction (e.g. the one shown before Prev/Next paged to a new entry in the
// external-signing transaction browser, which reuses this component instance without
// remounting it) can't land late and overwrite the current transaction's state.
let entityIdGeneration = 0;

/* Computed */
const contractCreateTransaction = computed(() =>
  props.transaction instanceof ContractCreateTransaction ? props.transaction : null,
);

// The new contract has no id at all until execution, so matching a saved contract (for
// constructor-arg decoding, and for the "already linked" check) can only ever go by entityId,
// never by anything on the transaction itself.
const matchingContract = computed(() =>
  entityId.value ? findMatchingSavedContract(savedContracts.value, entityId.value) : null,
);

const abi = computed<AbiItem[]>(() =>
  matchingContract.value ? parseStoredAbi(matchingContract.value.abi) : [],
);

const decodedConstructorArgs = computed(() => {
  const tx = contractCreateTransaction.value;
  if (!tx?.constructorParameters || abi.value.length === 0) {
    return null;
  }
  return decodeConstructorParams(abi.value, tx.constructorParameters);
});

const rawConstructorParametersHex = computed(() =>
  contractCreateTransaction.value?.constructorParameters
    ? uint8ToHex(contractCreateTransaction.value.constructorParameters)
    : null,
);

// Known upstream SDK gap (temporary - remove once the dependency is bumped past
// hiero-sdk-js#4660, see docs/contract-create-plan.md "Known upstream SDK gap"):
// ContractCreateTransaction.bytecode always comes back null once this transaction has been
// through Transaction.fromBytes() - which is unavoidably true here, since Details only ever
// receives a transaction read back from stored/transmitted bytes. bytecodeFileId is unaffected,
// so a null bytecodeFileId here almost always means inline bytecode was used and is simply not
// inspectable right now - not that the transaction has no bytecode (the create form requires
// one or the other to enable Create). The real submitted/deployed bytecode is unaffected either
// way; only this preview is degraded.
const bytecodeFileId = computed(() => contractCreateTransaction.value?.bytecodeFileId?.toString());

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';

/* Functions */
async function fetchEntityId(payer: string, seconds: string, nanos: string, generation: number) {
  const { data } = await safeAwait(
    transactionByIdCache.lookup(`${payer}-${seconds}-${nanos}`, network.mirrorNodeBaseURL),
  );

  if (!data?.transactions || data.transactions.length === 0 || generation !== entityIdGeneration) {
    return;
  }

  entityId.value = data.transactions[0].entity_id || null;
}

// Mirrors AccountDetails.vue/ContractExecuteDetails.vue: the real contract id only exists once
// the transaction has actually run, so this is skipped for an organization transaction still
// pending approval/execution. For a personal/local transaction there's no such status to gate
// on, so the lookup is tried after a short delay instead, to give mirror node time to index a
// creation that may have just executed.
async function checkAndFetchEntityId(generation: number) {
  const tx = contractCreateTransaction.value;
  if (!tx) {
    return;
  }

  const isExecutedOrganizationTransaction = Boolean(
    props.organizationTransaction?.status &&
      [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
        props.organizationTransaction.status,
      ),
  );

  if (!isExecutedOrganizationTransaction && props.organizationTransaction) {
    return;
  }

  const payer = tx.transactionId?.accountId?.toString();
  const seconds = tx.transactionId?.validStart?.seconds?.toString();
  const nanos = tx.transactionId?.validStart?.nanos?.toString();

  if (!payer || !seconds || !nanos) {
    return;
  }

  if (!props.organizationTransaction) {
    setTimeout(async () => await fetchEntityId(payer, seconds, nanos, generation), 1500);
  } else {
    await fetchEntityId(payer, seconds, nanos, generation);
  }
}

/* Hooks */
onMounted(async () => {
  await checkAndFetchEntityId(entityIdGeneration);

  if (!isUserLoggedIn(user.personal)) {
    return;
  }

  savedContracts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});

onBeforeUnmount(() => {
  entityIdGeneration++;
});

/* Watchers */
watch([() => props.transaction, () => props.organizationTransaction], () => {
  const generation = ++entityIdGeneration;
  entityId.value = null;
  setTimeout(async () => await checkAndFetchEntityId(generation), 3000);
});

watch(
  () => contractCreateTransaction.value?.adminKey,
  async (newValue, _oldValue, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    formattedKey.value = '';
    if (newValue instanceof PublicKey) {
      let label = newValue.toStringRaw();
      try {
        label = await formatPublicKey(label, appCache.backendPublicKeyOwner);
      } catch {
        /* Ignore the lookup error and keep the raw key reviewable */
      }
      if (active) {
        formattedKey.value = label;
      }
    }
  },
  { immediate: true },
);
</script>
<template>
  <div v-if="contractCreateTransaction" class="mt-5 row flex-wrap">
    <div v-if="entityId" class="col-12 mb-3">
      <div class="flex-centered justify-content-start gap-4">
        <div>
          <h4 :class="detailItemLabelClass">New Contract ID</h4>
          <p :class="detailItemValueClass" data-testid="p-contract-create-details-new-contract-id">
            {{ entityId }}
          </p>
        </div>
        <div>
          <AppButton
            v-if="!matchingContract"
            class="min-w-unset"
            color="secondary"
            size="small"
            type="button"
            data-testid="button-contract-create-details-link-contract"
            @click="$router.push({ name: 'addSmartContract', query: { identifier: entityId } })"
            >Link Contract</AppButton
          >
          <span
            v-if="matchingContract"
            class="align-self-start text-small text-secondary"
            data-testid="p-contract-create-details-already-linked"
            >Contract already linked</span
          >
        </div>
      </div>
    </div>

    <!-- Admin Key -->
    <div class="col-12 my-3">
      <h4 :class="detailItemLabelClass">Admin Key</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-admin-key">
        <template v-if="!contractCreateTransaction.adminKey">
          None - this contract will be immutable (except for expiration/renewal)
        </template>
        <template v-else-if="contractCreateTransaction.adminKey instanceof KeyList">
          <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
            >See details</span
          >
        </template>
        <template v-else-if="contractCreateTransaction.adminKey instanceof PublicKey">
          <span class="text-semi-bold" :class="{ 'text-pink': !extractIdentifier(formattedKey) }">
            {{ contractCreateTransaction.adminKey._key._type }}
          </span>
          <span v-if="extractIdentifier(formattedKey)" class="d-flex flex-row flex-wrap gap-2">
            <span class="text-small text-pink">{{
              extractIdentifier(formattedKey)?.identifier
            }}</span>
            <span class="text-secondary text-small">{{
              `(${extractIdentifier(formattedKey)?.pk})`
            }}</span>
          </span>
          <span v-else>{{ formattedKey || contractCreateTransaction.adminKey.toStringRaw() }}</span>
          <span v-if="!formattedKey" role="status"> Loading key owner…</span>
        </template>
        <template v-else>
          <KeyComponent :component="contractCreateTransaction.adminKey" />
        </template>
      </p>
    </div>

    <!-- Bytecode -->
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Bytecode</h4>
      <p v-if="bytecodeFileId" :class="detailItemValueClass" data-testid="p-contract-create-details-bytecode-file-id">
        File {{ bytecodeFileId }}
      </p>
      <p v-else class="text-micro text-secondary mt-1" data-testid="p-contract-create-details-bytecode-unavailable">
        Inline bytecode is not previewable here right now (temporary limitation, see
        hiero-sdk-js#4660) - this does not affect what will actually be deployed.
      </p>
    </div>

    <!-- Gas -->
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Gas</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-gas">
        {{ contractCreateTransaction.gas?.toString() }}
      </p>
    </div>

    <!-- Initial balance -->
    <div v-if="contractCreateTransaction.initialBalance" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Initial Balance</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-initial-balance">
        {{ stringifyHbar(contractCreateTransaction.initialBalance) }}
      </p>
    </div>

    <!-- Memo -->
    <div v-if="contractCreateTransaction.contractMemo" class="col-12 my-3">
      <h4 :class="detailItemLabelClass">Memo</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-memo">
        {{ contractCreateTransaction.contractMemo }}
      </p>
    </div>

    <!-- Auto renew account -->
    <div v-if="contractCreateTransaction.autoRenewAccountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Auto Renew Account</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-auto-renew-account">
        {{ contractCreateTransaction.autoRenewAccountId.toString() }}
      </p>
    </div>

    <!-- Max automatic token associations -->
    <div v-if="contractCreateTransaction.maxAutomaticTokenAssociations" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Max Automatic Token Associations</h4>
      <p :class="detailItemValueClass">
        {{ contractCreateTransaction.maxAutomaticTokenAssociations }}
      </p>
    </div>

    <!-- Staking -->
    <div
      v-if="
        contractCreateTransaction.stakedNodeId !== null ||
        contractCreateTransaction.stakedAccountId !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Staking</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-staking">
        {{
          contractCreateTransaction.stakedAccountId
            ? `Account ${contractCreateTransaction.stakedAccountId.toString()}`
            : contractCreateTransaction.stakedNodeId !== null
              ? `Node ${contractCreateTransaction.stakedNodeId.toString()}`
              : 'Unstaked'
        }}
      </p>
    </div>

    <div
      v-if="
        contractCreateTransaction.stakedNodeId !== null ||
        contractCreateTransaction.stakedAccountId !== null
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Accept Staking Rewards</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-create-details-accept-rewards">
        {{ contractCreateTransaction.declineStakingRewards ? 'No' : 'Yes' }}
      </p>
    </div>

    <!-- Constructor parameters -->
    <div v-if="rawConstructorParametersHex" class="col-12 py-3">
      <h4 :class="detailItemLabelClass">Constructor Parameters</h4>
      <p
        v-if="decodedConstructorArgs"
        :class="detailItemValueClass"
        data-testid="p-contract-create-details-constructor-args"
      >
        {{ decodedConstructorArgs.map(a => `${a.type} ${a.name} = ${a.value}`).join(', ') || '()' }}
      </p>
      <p
        v-else-if="!entityId"
        class="text-small text-secondary overflow-hidden mt-1"
        data-testid="p-contract-create-details-constructor-args-pending"
      >
        This contract hasn't been created yet, so there's no saved ABI to decode these parameters
        against - raw bytes: 0x{{ rawConstructorParametersHex }}
      </p>
      <p
        v-else-if="abi.length === 0"
        class="text-small text-secondary overflow-hidden mt-1"
        data-testid="p-contract-create-details-constructor-args-no-abi"
      >
        No saved ABI for this contract on this network - link it under Smart Contracts to decode
        these parameters.
      </p>
      <p v-else class="text-micro text-secondary mt-2">
        This constructor has a parameter type (array or tuple) that isn't decoded for display yet
        - raw bytes: 0x{{ rawConstructorParametersHex }}
      </p>
    </div>

    <KeyStructureModal
      v-model:show="isKeyStructureModalShown"
      :account-key="contractCreateTransaction.adminKey"
    />
  </div>
</template>
