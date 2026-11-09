<script setup lang="ts">
import type { SmartContract } from '@prisma/client';
import type { ContractExecuteData } from '@renderer/utils/sdk';

import { computed, onMounted, ref, watch } from 'vue';
import { AccountId, Hbar } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/smartContractsService';
import {
  getAbiFunctions,
  isFullyDecodableAbiFunction,
  parseAbiJson,
  type AbiItem,
} from '@renderer/utils/sdk/abi';
import {
  getFunctionSignature,
  parseFunctionTags,
  parseRoles,
  roleHolderSummary,
} from '@renderer/utils/sdk/contractRoles';
import {
  areContractCallArgsEncodable,
  decodeContractCall,
  isAllowedFunctionArgKey,
  sanitizeFunctionArgInput,
  validateFunctionArgValue,
} from '@renderer/utils/sdk/contractFunctionParams';
import {
  checkAccountHasRole,
  parseContractReference,
  simulateContractCall,
} from '@renderer/utils/sdk/contractCall';

import { hexToUint8Array, isAccountId, isUserLoggedIn, getErrorMessage } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import ContractIdInput from './ContractIdInput.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

/* Props */
const props = defineProps<{
  data: ContractExecuteData;
  payerId: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: ContractExecuteData): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const savedContracts = ref<SmartContract[]>([]);
const manualAbiFile = ref<{ meta: File; content: Uint8Array; loadPercentage: number } | null>(null);
const manualAbi = ref<AbiItem[] | null>(null);
const manualAbiError = ref('');

/* Computed */
const savedContractItems = computed(() =>
  savedContracts.value
    .map(c => ({ value: c.contract_id || c.evm_address || '', nickname: c.nickname || '' }))
    .filter(i => i.value),
);

// A saved contract is "selected" whenever the entered ID / EVM address matches one.
const selectedSavedContract = computed(() => {
  const entered = props.data.contractId.trim().toLowerCase();
  if (!entered) {
    return null;
  }
  return (
    savedContracts.value.find(
      c =>
        c.contract_id?.toLowerCase() === entered ||
        c.evm_address?.toLowerCase() === entered ||
        c.evm_address?.toLowerCase() === `0x${entered}`,
    ) || null
  );
});

const abi = computed<AbiItem[]>(() => {
  if (selectedSavedContract.value) {
    try {
      return JSON.parse(selectedSavedContract.value.abi) as AbiItem[];
    } catch {
      return [];
    }
  }
  return manualAbi.value || [];
});

const callableFunctions = computed(() =>
  getAbiFunctions(abi.value).filter(isFullyDecodableAbiFunction),
);

const functionOptions = computed(() => [
  { label: 'Select a function', value: '' },
  ...callableFunctions.value.map(fn => ({
    label: `${fn.name}(${fn.inputs.map(i => i.type).join(', ')})`,
    value: fn.name,
  })),
]);

const selectedFunction = computed(
  () => callableFunctions.value.find(f => f.name === props.data.functionName) || null,
);

// null while empty (Create button gating covers that) or for bool (checkbox can't be malformed).
const argErrors = computed(() =>
  props.data.functionArgs.map(arg =>
    arg.type === 'bool' || arg.value === '' ? null : validateFunctionArgValue(arg.type, arg.value),
  ),
);

const roles = computed(() => parseRoles(selectedSavedContract.value?.roles));

const functionTags = computed(() => parseFunctionTags(selectedSavedContract.value?.function_tags));

const taggedRole = computed(() => {
  const fn = callableFunctions.value.find(f => f.name === props.data.functionName);
  if (!fn) {
    return null;
  }
  const roleId = functionTags.value[getFunctionSignature(fn)];
  return roles.value.find(r => r.id === roleId) || null;
});

// Local check: no network needed, just compares the chosen fee payer against whatever the
// registry already records as this role's holder.
const localRoleMismatch = computed(() => {
  const role = taggedRole.value;
  return Boolean(
    role &&
    role.holderType === 'account' &&
    role.holderAccountId &&
    props.payerId.trim().length > 0 &&
    props.payerId !== role.holderAccountId,
  );
});

const contractEvmAddress = computed(() => {
  const reference = selectedSavedContract.value
    ? // a saved contract always has at least one of the two (enforced when it is added)
      selectedSavedContract.value.contract_id || selectedSavedContract.value.evm_address!
    : props.data.contractId;
  const parsed = parseContractReference(reference);
  return parsed ? `0x${parsed.toEvmAddress()}` : null;
});

// Online check: a live hasRole(role, account) read, run only when the registry has a verified
// (on-chain-resolved) role value - never guesses, and fails silently (status 'unknown') so a
// network hiccup doesn't block anything, it just removes this one extra signal.
type OnlineRoleCheckStatus = 'idle' | 'checking' | 'pass' | 'fail' | 'unknown';
const onlineRoleCheckStatus = ref<OnlineRoleCheckStatus>('idle');

// Online check: simulates the exact call (function, args, gas, payable amount, fee payer) via
// the mirror node before the user signs - catches reverts and under-provisioned gas early. Purely
// advisory, same as the role check above: mirror node state can drift before the real transaction
// executes, so this reports what would *currently* happen, not a guarantee.
type CallSimulationUiStatus = 'idle' | 'checking' | 'pass' | 'fail' | 'unknown';
const callSimulationStatus = ref<CallSimulationUiStatus>('idle');
const callSimulationError = ref('');

/* Handlers */
function emitUpdate(partial: Partial<ContractExecuteData>) {
  emit('update:data', { ...props.data, ...partial });
}

function handleContractIdUpdate(value: string) {
  emitUpdate({
    contractId: value,
    functionName: '',
    functionArgs: [],
    payableAmount: new Hbar(0),
    rawFunctionParametersHex: '',
  });
}

const handleManualAbiFileUpdate = async (
  file: { meta: File; content: Uint8Array; loadPercentage: number } | null,
) => {
  manualAbiFile.value = file;
  manualAbi.value = null;
  manualAbiError.value = '';

  if (!file || file.loadPercentage < 100) {
    return;
  }

  try {
    const text = new TextDecoder().decode(file.content);
    manualAbi.value = parseAbiJson(text);
    emitUpdate({ functionName: '', functionArgs: [] });
  } catch (error) {
    manualAbiError.value = getErrorMessage(error, 'Failed to parse ABI file');
  }
};

function handleFunctionChange(name: string) {
  const fn = callableFunctions.value.find(f => f.name === name) || null;
  emitUpdate({
    functionName: name,
    // payable amount only applies to payable functions - don't carry it over to another one
    payableAmount: fn?.stateMutability === 'payable' ? props.data.payableAmount : new Hbar(0),
    rawFunctionParametersHex: '',
    functionArgs: fn
      ? fn.inputs.map(input => ({ name: input.name, type: input.type, value: '' }))
      : [],
  });
}

function handleArgKeyDown(e: KeyboardEvent, type: string) {
  // only single printable characters are charset-restricted - let navigation, selection,
  // backspace/delete, and copy/paste-style modifier combos through untouched
  if (e.ctrlKey || e.metaKey || e.key.length !== 1) {
    return;
  }
  if (!isAllowedFunctionArgKey(type, e.key, (e.target as HTMLInputElement).value)) {
    e.preventDefault();
  }
}

function handleArgValueChange(index: number, value: string) {
  const nextArgs = props.data.functionArgs.map((arg, i) =>
    i === index ? { ...arg, value: sanitizeFunctionArgInput(arg.type, value) } : arg,
  );
  emitUpdate({ functionArgs: nextArgs });
}

function handleGasChange(value: string) {
  emitUpdate({ gas: Number(value) || 0 });
}

/* Watchers */
// A reloaded draft only carries raw calldata; once the ABI is known, match its selector back to
// a function (and decode static args) so the selection shows up again.
watch(
  [abi, () => props.data.rawFunctionParametersHex, () => props.data.functionName],
  () => {
    const hex = props.data.rawFunctionParametersHex;
    if (props.data.functionName || !hex || abi.value.length === 0) {
      return;
    }
    const decoded = decodeContractCall(abi.value, hexToUint8Array(hex));
    if (decoded?.args) {
      emitUpdate({
        functionName: decoded.functionName,
        functionArgs: decoded.args,
        rawFunctionParametersHex: '',
      });
    }
  },
  { immediate: true },
);

watch(
  [taggedRole, () => props.payerId, contractEvmAddress],
  async ([role, payerId, toAddress]) => {
    onlineRoleCheckStatus.value = 'idle';

    if (!role || !role.verified || !role.value || !toAddress || !isAccountId(payerId)) {
      return;
    }

    onlineRoleCheckStatus.value = 'checking';

    const result = await checkAccountHasRole(
      { evmAddress: toAddress },
      role.value,
      payerId,
      network.mirrorNodeBaseURL,
    );
    onlineRoleCheckStatus.value = result;
  },
  { immediate: true },
);

watch(
  [
    selectedFunction,
    () => props.data.functionArgs,
    () => props.data.gas,
    () => props.data.payableAmount,
    () => props.payerId,
    contractEvmAddress,
  ],
  async ([fn, args, gas, payableAmount, payerId, toAddress]) => {
    callSimulationStatus.value = 'idle';
    callSimulationError.value = '';

    if (!fn || !toAddress || !isAccountId(payerId) || !areContractCallArgsEncodable(args)) {
      return;
    }

    callSimulationStatus.value = 'checking';
    const result = await simulateContractCall(
      { evmAddress: toAddress },
      fn.name,
      args,
      {
        gas,
        valueTinybars: payableAmount.toTinybars().toNumber(),
        from: `0x${AccountId.fromString(payerId).toEvmAddress()}`,
      },
      network.mirrorNodeBaseURL,
    );
    callSimulationStatus.value = result.status;
    callSimulationError.value = result.errorMessage || '';
  },
  { immediate: true, deep: true },
);

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
  <div class="row align-items-start">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Contract ID / EVM Address <span class="text-danger">*</span></label>
      <ContractIdInput
        :model-value="data.contractId"
        @update:model-value="handleContractIdUpdate"
        :items="savedContractItems"
        placeholder="0.0.1234 or 0x..."
        data-testid="input-contract-execute-contract-id"
      />
    </div>
    <!-- invisible (not v-if) so the row keeps its height and nothing below shifts -->
    <div class="form-group col-6 col-xxxl-4" :class="{ invisible: selectedSavedContract }">
      <label class="form-label">Contract ABI <span class="text-danger">*</span></label>
      <AppUploadFile
        id="contract-execute-manual-abi-upload"
        :file="manualAbiFile"
        :max-size-kb="2048"
        accept=".json"
        show-name
        @update:file="handleManualAbiFileUpdate"
      />
      <p v-if="manualAbiError" class="text-danger text-small mt-2">{{ manualAbiError }}</p>
    </div>
  </div>

  <div class="row align-items-end mt-4">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Gas <span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.gas.toString()"
        @update:model-value="handleGasChange"
        :filled="true"
        type="number"
        min="0"
        placeholder="Enter gas limit"
        data-testid="input-contract-execute-gas"
      />
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Function <span class="text-danger">*</span></label>
      <select
        class="form-select is-fill"
        :value="data.functionName"
        @change="handleFunctionChange(($event.target as HTMLSelectElement).value)"
        :disabled="callableFunctions.length === 0"
        data-testid="select-contract-execute-function"
      >
        <option v-for="option in functionOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <p
        v-if="abi.length > 0 && callableFunctions.length === 0"
        class="text-small text-secondary mt-2"
      >
        No callable functions found in this ABI.
      </p>

      <div v-if="selectedFunction?.stateMutability === 'payable'" class="mt-4">
        <label class="form-label">Payable Amount</label>
        <AppHbarInput
          :model-value="data.payableAmount"
          @update:model-value="(v: Hbar) => emitUpdate({ payableAmount: v })"
          :filled="true"
          placeholder="0"
          data-testid="input-contract-execute-payable-amount"
        />
      </div>

      <template v-if="taggedRole">
        <p class="text-micro text-secondary mt-2">
          Requires: {{ taggedRole.name }} ({{ roleHolderSummary(taggedRole) }})
        </p>
        <!-- Strictest: verified on-chain that the fee payer lacks the role -->
        <div
          v-if="onlineRoleCheckStatus === 'fail'"
          class="alert alert-danger text-small mt-2 mb-0"
          role="alert"
          data-testid="alert-contract-execute-role-fail"
        >
          <i class="bi bi-exclamation-octagon-fill me-1" />
          <span class="text-semi-bold">This call will likely fail.</span>
          The fee payer does not hold {{ taggedRole.name }} on-chain, so the contract will reject
          this call. Select the account that holds this role as the fee payer.
        </div>
        <!-- Warning: fee payer differs from the recorded role holder (not confirmed on-chain) -->
        <div
          v-else-if="localRoleMismatch && onlineRoleCheckStatus !== 'pass'"
          class="alert alert-warning text-small mt-2 mb-0"
          role="alert"
          data-testid="alert-contract-execute-role-mismatch"
        >
          <i class="bi bi-exclamation-triangle-fill me-1" />
          This function requires {{ taggedRole.name }}, but the selected fee payer is not the
          recorded holder ({{ roleHolderSummary(taggedRole) }}).
        </div>
        <p v-else-if="onlineRoleCheckStatus === 'checking'" class="text-micro text-secondary mt-1">
          Checking on-chain...
        </p>
        <p v-else-if="onlineRoleCheckStatus === 'pass'" class="text-micro text-success mt-1">
          Fee payer currently holds {{ taggedRole.name }} on-chain.
        </p>
      </template>

      <!-- Simulated call result - skipped when the role check above already explains the failure -->
      <div
        v-if="callSimulationStatus === 'fail' && onlineRoleCheckStatus !== 'fail'"
        class="alert alert-warning text-small mt-2 mb-0"
        role="alert"
        data-testid="alert-contract-execute-simulation-fail"
      >
        <i class="bi bi-exclamation-triangle-fill me-1" />
        <span class="text-semi-bold">This call would currently fail.</span>
        {{ callSimulationError || 'The simulated call reverted or ran out of gas.' }}
      </div>
      <p
        v-else-if="callSimulationStatus === 'checking'"
        class="text-micro text-secondary mt-1"
        data-testid="text-contract-execute-simulation-checking"
      >
        Simulating call...
      </p>
      <p
        v-else-if="callSimulationStatus === 'pass'"
        class="text-micro text-success mt-1"
        data-testid="text-contract-execute-simulation-pass"
      >
        Simulated call currently succeeds.
      </p>
    </div>
  </div>

  <div v-if="data.functionArgs.length > 0" class="mt-6">
    <p class="text-small text-semi-bold">Parameters</p>
    <div
      v-for="(arg, index) in data.functionArgs"
      :key="arg.name + index"
      class="row align-items-end mt-3"
    >
      <div class="form-group col-6 col-xxxl-4">
        <label class="form-label">{{ arg.name || `param${index}` }}</label>
        <AppCheckBox
          v-if="arg.type === 'bool'"
          :checked="arg.value === 'true'"
          @update:checked="(v: boolean) => handleArgValueChange(index, v ? 'true' : 'false')"
          :name="`contract-execute-arg-${index}`"
          :data-testid="'input-contract-execute-arg-' + index"
        />
        <AppInput
          v-else
          :model-value="arg.value"
          @update:model-value="(v: string) => handleArgValueChange(index, v)"
          @keydown="(e: KeyboardEvent) => handleArgKeyDown(e, arg.type)"
          :filled="true"
          :placeholder="arg.type"
          :data-testid="'input-contract-execute-arg-' + index"
        />
        <p
          v-if="argErrors[index]"
          class="text-danger text-small mt-1"
          :data-testid="'error-contract-execute-arg-' + index"
        >
          {{ argErrors[index] }}
        </p>
      </div>
    </div>
  </div>
</template>
