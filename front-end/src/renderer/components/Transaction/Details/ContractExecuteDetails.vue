<script setup lang="ts">
import type { SmartContract } from '@prisma/client';
import type { ITransactionFull } from '@shared/interfaces';

import { computed, onMounted, ref } from 'vue';

import { ContractExecuteTransaction, ContractId, Transaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/smartContractsService';
import { decodeContractCall } from '@renderer/utils/sdk/contractFunctionParams';
import type { AbiItem } from '@renderer/utils/sdk/abi';

import { isUserLoggedIn, stringifyHbar, uint8ToHex } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const savedContracts = ref<SmartContract[]>([]);

/* Computed */
const contractExecuteTransaction = computed(() =>
  props.transaction instanceof ContractExecuteTransaction ? props.transaction : null,
);

// Matches on either identifier form, since a contract targeted by EVM address and the same
// contract saved by its "0.0.X" id (or vice versa) should still resolve to the same ABI.
const matchingContract = computed(() => {
  const tx = contractExecuteTransaction.value;
  const contractId = tx?.contractId;
  if (!contractId) {
    return null;
  }

  const txEvmAddress = contractId.toEvmAddress();

  return (
    savedContracts.value.find(c => {
      if (c.contract_id && c.contract_id === contractId.toString()) {
        return true;
      }
      if (c.contract_id) {
        try {
          if (ContractId.fromString(c.contract_id).toEvmAddress() === txEvmAddress) {
            return true;
          }
        } catch {
          // not a plain "0.0.X" id - fall through to the evm_address check below
        }
      }
      if (c.evm_address) {
        const saved = c.evm_address.startsWith('0x') ? c.evm_address.slice(2) : c.evm_address;
        if (saved.toLowerCase() === txEvmAddress.toLowerCase()) {
          return true;
        }
      }
      return false;
    }) || null
  );
});

const abi = computed<AbiItem[]>(() => {
  if (!matchingContract.value) {
    return [];
  }
  try {
    return JSON.parse(matchingContract.value.abi) as AbiItem[];
  } catch {
    return [];
  }
});

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

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';

/* Hooks */
onMounted(async () => {
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
</script>
<template>
  <div v-if="contractExecuteTransaction" class="mt-5 row flex-wrap">
    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Contract ID</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-execute-details-contract-id">
        {{ contractExecuteTransaction.contractId?.toString() || 'None' }}
      </p>
    </div>

    <div :class="commonColClass">
      <h4 :class="detailItemLabelClass">Gas</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-execute-details-gas">
        {{ contractExecuteTransaction.gas?.toString() || '0' }}
      </p>
    </div>

    <div v-if="contractExecuteTransaction.payableAmount" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Payable Amount</h4>
      <p :class="detailItemValueClass" data-testid="p-contract-execute-details-payable-amount">
        {{ stringifyHbar(contractExecuteTransaction.payableAmount) }}
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
        This function has a parameter type (array, string, or dynamic bytes) that isn't decoded
        for display yet - full calldata: 0x{{ rawCalldataHex }}
      </p>
    </div>
  </div>
</template>
