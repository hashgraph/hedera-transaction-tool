<script setup lang="ts">
import type { SmartContract } from '@prisma/client';
import { type ITransactionFull, TransactionStatus } from '@shared/interfaces';

import { computed, onMounted, ref, watch } from 'vue';

import { ContractExecuteTransaction, Transaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/smartContractsService';
import { decodeContractCall, decodeContractCallResult } from '@renderer/utils/sdk/contractFunctionParams';
import { contractIdToReference, findMatchingSavedContract } from '@renderer/utils/sdk/contractCall';
import { parseStoredAbi, type AbiItem } from '@renderer/utils/sdk/abi';
import { AppCache } from '@renderer/caches/AppCache.ts';

import { isUserLoggedIn, stringifyHbar, uint8ToHex, hexToUint8Array, safeAwait } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Injected */
const contractResultCache = AppCache.inject().mirrorContractResultByTransactionId;

/* State */
const savedContracts = ref<SmartContract[]>([]);
const callResultHex = ref<string | null>(null);
const resultErrorMessage = ref<string | null>(null);

// Bumped whenever the displayed transaction changes, so a result fetch started for a previous
// transaction (e.g. the one shown before Prev/Next paged to a new entry in the external-signing
// transaction browser, which reuses this component instance without remounting it) can't land
// late and overwrite the current transaction's state.
let contractResultGeneration = 0;

/* Computed */
const contractExecuteTransaction = computed(() =>
  props.transaction instanceof ContractExecuteTransaction ? props.transaction : null,
);

// Matches on either identifier form, since a contract targeted by EVM address and the same
// contract saved by its "0.0.X" id (or vice versa) should still resolve to the same ABI.
const matchingContract = computed(() => {
  const contractId = contractExecuteTransaction.value?.contractId;
  return contractId
    ? findMatchingSavedContract(savedContracts.value, contractIdToReference(contractId))
    : null;
});

const abi = computed<AbiItem[]>(() =>
  matchingContract.value ? parseStoredAbi(matchingContract.value.abi) : [],
);

const decoded = computed(() => {
  const tx = contractExecuteTransaction.value;
  if (!tx?.functionParameters || abi.value.length === 0) {
    return null;
  }
  return decodeContractCall(abi.value, tx.functionParameters);
});

// Only rendered once `decoded` has non-empty calldata to show, so it is always present here
const rawCalldataHex = computed(() =>
  uint8ToHex(contractExecuteTransaction.value!.functionParameters!),
);

const decodedResult = computed(() => {
  const tx = contractExecuteTransaction.value;
  if (!tx?.functionParameters || abi.value.length === 0 || !callResultHex.value) {
    return null;
  }
  return decodeContractCallResult(
    abi.value,
    tx.functionParameters,
    hexToUint8Array(callResultHex.value),
  );
});

// '0x' is mirror node's encoding of "no return data" (a void function, or a reverted call) -
// nothing useful to decode or show as raw bytes in that case.
const hasCallResult = computed(
  () => !!callResultHex.value && callResultHex.value !== '0x',
);

// A transaction loaded from stored bytes has already round-tripped through protobuf, which has no
// concept of "unset" for a plain numeric field - payableAmount comes back as Hbar(0), not null,
// even for a non-payable call that never set it. A nonzero check is what actually distinguishes a
// call that sent hbar from one that didn't, without re-deriving "is this function payable" from
// the ABI on every render.
const payableAmount = computed(() => {
  const amount = contractExecuteTransaction.value?.payableAmount;
  return amount && amount.toBigNumber().gt(0) ? amount : null;
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';

/* Functions */
async function fetchContractResult(
  payer: string,
  seconds: string,
  nanos: string,
  generation: number,
) {
  const { data } = await safeAwait(
    contractResultCache.lookup(`${payer}-${seconds}-${nanos}`, network.mirrorNodeBaseURL),
  );

  // A newer transaction may have replaced this one (and already reset these refs) while the
  // lookup was in flight - dropping the stale result here is what contractResultGeneration guards.
  if (!data || generation !== contractResultGeneration) {
    return;
  }

  callResultHex.value = data.callResult;
  resultErrorMessage.value = data.errorMessage;
}

// Mirrors AccountDetails.vue's checkAndFetchTransactionInfo: a result only exists once the
// transaction has actually run, so this is skipped for an organization transaction still pending
// approval/execution. For a personal/local transaction (no organizationTransaction) there's no
// such status to gate on here, so the lookup is tried after a short delay instead, to give mirror
// node time to index a call that may have just executed.
async function checkAndFetchContractResult(generation: number) {
  const tx = contractExecuteTransaction.value;
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
    setTimeout(async () => await fetchContractResult(payer, seconds, nanos, generation), 1500);
  } else {
    await fetchContractResult(payer, seconds, nanos, generation);
  }
}

/* Hooks */
onMounted(async () => {
  await checkAndFetchContractResult(contractResultGeneration);

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

/* Watchers */
watch([() => props.transaction, () => props.organizationTransaction], () => {
  const generation = ++contractResultGeneration;
  callResultHex.value = null;
  resultErrorMessage.value = null;
  setTimeout(async () => await checkAndFetchContractResult(generation), 3000);
});
</script>
<template>
  <div v-if="contractExecuteTransaction" class="mt-5 row flex-wrap">
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Contract ID</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-execute-details-contract-id">
        {{
          contractExecuteTransaction.contractId
            ? contractIdToReference(contractExecuteTransaction.contractId)
            : 'None'
        }}
      </p>
    </div>

    <div v-if="payableAmount" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Payable Amount</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-execute-details-payable-amount">
        {{ stringifyHbar(payableAmount) }}
      </p>
    </div>

    <div class="col-12 py-3">
      <h4 :class="detailItemLabelClass">Function</h4>
      <p
        v-if="decoded"
        :class="detailItemValueClass"
        data-testid="p-contract-execute-details-function"
      >
        {{ decoded.functionName }}({{
          decoded.args
            ? decoded.args.map(a => `${a.type} ${a.name} = ${a.value}`).join(', ')
            : '...'
        }})
      </p>
      <p
        v-else-if="abi.length === 0"
        class="text-small text-secondary overflow-hidden mt-1"
        data-testid="p-contract-execute-details-no-abi"
      >
        No saved ABI for this contract on this network - save it under Smart Contracts to decode
        this call.
      </p>
      <p v-else class="text-small text-secondary overflow-hidden mt-1">
        Could not match this call to a function in the saved ABI.
      </p>
      <p v-if="decoded && decoded.args === null" class="text-micro text-secondary mt-2">
        This function has a parameter type (array or tuple) that isn't decoded for display yet -
        full calldata: 0x{{ rawCalldataHex }}
      </p>
    </div>

    <div v-if="resultErrorMessage || hasCallResult" class="col-12 py-3">
      <h4 :class="detailItemLabelClass">Result</h4>
      <p
        v-if="resultErrorMessage"
        class="text-small text-pink overflow-hidden mt-1"
        data-testid="p-contract-execute-details-result-error"
      >
        {{ resultErrorMessage }}
      </p>
      <p
        v-else-if="decodedResult?.args"
        :class="detailItemValueClass"
        data-testid="p-contract-execute-details-result"
      >
        {{
          decodedResult.args
            .map(a => `${a.type}${a.name ? ` ${a.name}` : ''} = ${a.value}`)
            .join(', ')
        }}
      </p>
      <p
        v-else
        class="text-micro text-secondary mt-1"
        data-testid="p-contract-execute-details-result-raw"
      >
        No saved ABI matched this function's outputs for display - raw result: {{ callResultHex }}
      </p>
    </div>
  </div>
</template>
