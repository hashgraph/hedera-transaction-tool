<script setup lang="ts">
import type { ContractCreateData } from '@renderer/utils/sdk';
import type { Key } from '@hiero-ledger/sdk';
import { Hbar } from '@hiero-ledger/sdk';

import { computed, ref } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import {
  getAbiConstructor,
  isConstructorCallable,
  parseContractArtifact,
  type AbiItem,
  type StandardJsonSource,
} from '@renderer/utils/sdk/abi';
import {
  decodeConstructorParams,
  isAllowedFunctionArgKey,
  sanitizeFunctionArgInput,
  validateFunctionArgValue,
} from '@renderer/utils/sdk/contractFunctionParams';
import { getMaxContractBytecodeSize } from '@renderer/utils/sdk/privilegedPayer';

import { hexToUint8Array, getErrorMessage } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import ContractSourceViewer from '@renderer/pages/SmartContracts/components/ContractSourceViewer.vue';

/* Props */
const props = defineProps<{
  data: ContractCreateData;
  payerId: string;
  // Temporary, remove once the dependency is bumped past hiero-sdk-js#4660 (see
  // docs/contract-create-plan.md "Known upstream SDK gap"): true right after reloading a draft
  // whose inline bytecode could not be recovered, so the bytecode-upload section can tell the
  // user to re-upload it instead of silently showing an empty field.
  needsBytecodeReupload: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: ContractCreateData): void;
}>();

/* Stores */
const network = useNetworkStore();

/* State */
const artifactFile = ref<{ meta: File; content: Uint8Array; loadPercentage: number } | null>(null);
const parsedAbi = ref<AbiItem[] | null>(null);
const parsedSources = ref<StandardJsonSource[]>([]);
const parsedContractNameHint = ref<string | null>(null);
const artifactError = ref('');

/* Computed */
const maxBytecodeSize = computed(() => getMaxContractBytecodeSize(props.payerId || null));
const bytecodeByteLength = computed(() => Math.ceil(props.data.bytecodeHex.length / 2));
const isBytecodeOversized = computed(
  () => props.data.bytecodeSource === 'inline' && bytecodeByteLength.value > maxBytecodeSize.value,
);

const abiConstructor = computed(() => getAbiConstructor(parsedAbi.value || []));
const constructorIsSupported = computed(
  () => !abiConstructor.value || isConstructorCallable(abiConstructor.value),
);

// null while empty (Create button gating covers that) or for bool (checkbox can't be malformed).
const argErrors = computed(() =>
  props.data.constructorArgs.map(arg =>
    arg.type === 'bool' || arg.value === '' ? null : validateFunctionArgValue(arg.type, arg.value),
  ),
);

/* Handlers */
function emitUpdate(partial: Partial<ContractCreateData>) {
  emit('update:data', { ...props.data, ...partial });
}

function handleBytecodeSourceChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  if (value === 'inline' || value === 'file') {
    emitUpdate({ bytecodeSource: value });
  }
}

const handleArtifactFileUpdate = async (
  file: { meta: File; content: Uint8Array; loadPercentage: number } | null,
) => {
  artifactFile.value = file;
  artifactError.value = '';

  if (!file) {
    return;
  }
  if (file.loadPercentage < 100) {
    return;
  }

  try {
    const text = new TextDecoder().decode(file.content);
    const result = parseContractArtifact(text);

    if (result.abi !== null) {
      parsedAbi.value = result.abi;
      const ctor = getAbiConstructor(result.abi);

      // A reloaded draft only carries raw constructor-parameter bytes until the ABI is
      // (re-)uploaded (see needsBytecodeReupload and the "Known upstream SDK gap" note in
      // docs/contract-create-plan.md) - try decoding those against *this* upload's ABI first,
      // so re-uploading the same artifact restores the actual values instead of blanking them.
      // Only applies when nothing has been entered yet; a later re-upload (user already typed
      // values, or already has decoded ones) always resets to this ABI's blank fields instead.
      const pendingRawHex =
        props.data.constructorArgs.length === 0 ? props.data.rawConstructorParametersHex : '';
      const decoded = pendingRawHex
        ? decodeConstructorParams(result.abi, hexToUint8Array(pendingRawHex))
        : null;

      emitUpdate({
        constructorArgs:
          decoded ??
          (ctor ? ctor.inputs.map(input => ({ name: input.name, type: input.type, value: '' })) : []),
        rawConstructorParametersHex: '',
      });
    }
    if (result.bytecode !== null) {
      const hex = result.bytecode.startsWith('0x') ? result.bytecode.slice(2) : result.bytecode;
      emitUpdate({ bytecodeHex: hex });
    }
    if (result.sources.length > 0) {
      parsedSources.value = result.sources;
      parsedContractNameHint.value = result.contractNameHint;
    }
  } catch (error) {
    artifactError.value = getErrorMessage(error, 'Failed to parse file');
  }
};

function handleArgKeyDown(e: KeyboardEvent, type: string) {
  if (e.ctrlKey || e.metaKey || e.key.length !== 1) {
    return;
  }
  if (!isAllowedFunctionArgKey(type, e.key, (e.target as HTMLInputElement).value)) {
    e.preventDefault();
  }
}

function handleArgValueChange(index: number, value: string) {
  const nextArgs = props.data.constructorArgs.map((arg, i) =>
    i === index ? { ...arg, value: sanitizeFunctionArgInput(arg.type, value) } : arg,
  );
  emitUpdate({ constructorArgs: nextArgs });
}

function handleGasChange(value: string) {
  emitUpdate({ gas: Number(value) || 0 });
}

function handleStakeTypeChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  if (value === 'None') {
    emitUpdate({ stakeType: 'None', stakedNodeId: null, stakedAccountId: '' });
  } else if (value === 'Account' || value === 'Node') {
    emitUpdate({ stakeType: value });
  }
}

function handleNodeNumberChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  if (value === 'unselected') {
    emitUpdate({ stakedNodeId: null });
  } else if (!isNaN(Number(value))) {
    emitUpdate({ stakedNodeId: Number(value) });
  }
}
</script>
<template>
  <div class="row align-items-start">
    <div class="form-group col-8 col-xxxl-6">
      <KeyField
        :model-key="data.adminKey"
        label="Admin Key"
        @update:model-key="(key: Key) => emitUpdate({ adminKey: key })"
      />
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Bytecode Source</label>
      <select
        class="form-select is-fill"
        :value="data.bytecodeSource"
        @change="handleBytecodeSourceChange"
        data-testid="select-contract-create-bytecode-source"
      >
        <option value="inline">Upload bytecode</option>
        <option value="file">Existing File ID</option>
      </select>
    </div>
  </div>

  <div class="row align-items-start mt-4">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label"
        >Contract ABI / Bytecode <span class="text-danger">*</span></label
      >
      <AppUploadFile
        id="contract-create-artifact-upload"
        :file="artifactFile"
        :max-size-kb="4096"
        accept=".json"
        show-name
        @update:file="handleArtifactFileUpdate"
      />
      <p v-if="artifactError" class="text-danger text-small mt-2">{{ artifactError }}</p>
      <p
        v-else-if="needsBytecodeReupload && data.bytecodeSource === 'inline' && !data.bytecodeHex"
        class="text-warning text-small mt-2"
        data-testid="text-contract-create-reupload-needed"
      >
        This draft's bytecode could not be restored (a temporary SDK limitation) - please
        re-upload the contract artifact before creating.
      </p>
      <p
        v-else-if="isBytecodeOversized"
        class="text-danger text-small mt-2"
        data-testid="text-contract-create-bytecode-oversized"
      >
        This bytecode ({{ bytecodeByteLength }} bytes) exceeds the transaction size limit
        ({{ maxBytecodeSize }} bytes). Upload it as a File first (FileCreate/FileAppend), then
        switch "Bytecode Source" to "Existing File ID" and enter that File ID.
      </p>
      <p
        v-else-if="data.bytecodeSource === 'inline' && data.bytecodeHex"
        class="text-success text-small mt-2"
      >
        Bytecode loaded ({{ bytecodeByteLength }} bytes).
      </p>
      <p v-if="parsedAbi && !constructorIsSupported" class="text-warning text-small mt-2">
        This constructor has parameter types that cannot be entered here (e.g. a struct/tuple or
        array) - double-check the deployed contract's initial state.
      </p>
    </div>

    <div v-if="data.bytecodeSource === 'file'" class="form-group col-6 col-xxxl-4">
      <label class="form-label">Bytecode File ID <span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.bytecodeFileId"
        @update:model-value="(v: string) => emitUpdate({ bytecodeFileId: v })"
        :filled="true"
        placeholder="0.0.1234"
        data-testid="input-contract-create-bytecode-file-id"
      />
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Gas <span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.gas.toString()"
        @update:model-value="handleGasChange"
        :filled="true"
        type="number"
        min="0"
        placeholder="Enter gas limit"
        data-testid="input-contract-create-gas"
      />
    </div>
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Initial Balance</label>
      <AppHbarInput
        :model-value="data.initialBalance"
        @update:model-value="(v: Hbar) => emitUpdate({ initialBalance: v })"
        :filled="true"
        placeholder="0"
        data-testid="input-contract-create-initial-balance"
      />
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Contract Memo</label>
      <AppInput
        :model-value="data.contractMemo"
        @update:model-value="(v: string) => emitUpdate({ contractMemo: v })"
        :filled="true"
        placeholder="Enter contract memo"
        data-testid="input-contract-create-memo"
      />
    </div>
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Max Automatic Token Associations</label>
      <AppInput
        :model-value="data.maxAutomaticTokenAssociations.toString()"
        @update:model-value="(v: string) => emitUpdate({ maxAutomaticTokenAssociations: Number(v) || 0 })"
        :filled="true"
        type="number"
        min="0"
        data-testid="input-contract-create-max-auto-token-associations"
      />
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Auto Renew Account</label>
      <AccountIdInput
        :model-value="data.autoRenewAccountId"
        @update:model-value="(v: string) => emitUpdate({ autoRenewAccountId: v })"
        data-testid="input-contract-create-auto-renew-account"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-6 col-xxxl-4">
      <label class="form-label">Staking</label>
      <select
        class="form-select is-fill"
        :value="data.stakeType"
        @change="handleStakeTypeChange"
        data-testid="select-contract-create-stake-type"
      >
        <option value="None">None</option>
        <option value="Account">Account</option>
        <option value="Node">Node</option>
      </select>
    </div>
    <div v-if="data.stakeType === 'Account'" class="form-group col-6 col-xxxl-4">
      <label class="form-label">Staked Account</label>
      <AccountIdInput
        :model-value="data.stakedAccountId"
        @update:model-value="(v: string) => emitUpdate({ stakedAccountId: v })"
        data-testid="input-contract-create-staked-account"
      />
    </div>
    <div v-else-if="data.stakeType === 'Node'" class="form-group col-6 col-xxxl-4">
      <label class="form-label">Node Number</label>
      <select
        class="form-select is-fill"
        name="node_number"
        @change="handleNodeNumberChange"
        data-testid="select-contract-create-staked-node"
      >
        <option
          value="unselected"
          :selected="data.stakedNodeId === null"
          data-testid="option-no-node-selected"
        >
          No node selected
        </option>
        <template v-for="nodeNumber in network.nodeNumbers" :key="nodeNumber">
          <option
            :value="nodeNumber"
            :selected="data.stakedNodeId === nodeNumber"
            :data-testid="'option-node-' + nodeNumber"
          >
            {{ nodeNumber }}
          </option>
        </template>
      </select>
    </div>
  </div>

  <div class="form-group mt-6">
    <AppSwitch
      :checked="!data.declineStakingReward"
      @update:checked="(v: boolean) => emitUpdate({ declineStakingReward: !v })"
      name="contract-create-accept-staking-rewards"
      data-testid="switch-contract-create-accept-staking-rewards"
      label="Accept staking rewards"
    />
  </div>

  <div v-if="data.constructorArgs.length > 0" class="mt-6">
    <p class="text-small text-semi-bold">Constructor Parameters</p>
    <div
      v-for="(arg, index) in data.constructorArgs"
      :key="arg.name + index"
      class="row align-items-end mt-3"
    >
      <div class="form-group col-6 col-xxxl-4">
        <label class="form-label">{{ arg.name || `param${index}` }}</label>
        <AppCheckBox
          v-if="arg.type === 'bool'"
          :checked="arg.value === 'true'"
          @update:checked="(v: boolean) => handleArgValueChange(index, v ? 'true' : 'false')"
          :name="`contract-create-arg-${index}`"
          :data-testid="'input-contract-create-arg-' + index"
        />
        <AppInput
          v-else
          :model-value="arg.value"
          @update:model-value="(v: string) => handleArgValueChange(index, v)"
          @keydown="(e: KeyboardEvent) => handleArgKeyDown(e, arg.type)"
          :filled="true"
          :placeholder="arg.type"
          :auto-trim="arg.type !== 'string'"
          :data-testid="'input-contract-create-arg-' + index"
        />
        <p
          v-if="argErrors[index]"
          class="text-danger text-small mt-1"
          :data-testid="'error-contract-create-arg-' + index"
        >
          {{ argErrors[index] }}
        </p>
      </div>
    </div>
  </div>

  <div v-if="parsedSources.length > 0" class="mt-6" style="height: 20rem">
    <p class="text-small text-semi-bold">
      {{ parsedContractNameHint || 'Contract' }} source code
    </p>
    <ContractSourceViewer
      class="h-100"
      :contract-name="parsedContractNameHint || ''"
      :sources="parsedSources"
    />
  </div>
</template>
