<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { add } from '@renderer/services/smartContractsService';
import { getContractInfo, type ContractInfo } from '@renderer/services/mirrorNodeDataService';
import { getVerifiedContract, type VerifiedContract } from '@renderer/services/sourcifyService';
import { getAbiFunctions, parseAbiJson, type AbiItem } from '@renderer/utils/sdk/abi';
import { parseContractReference } from '@renderer/utils/sdk/contractCall';

import { isUserLoggedIn, getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import ContractSourceViewer from '../components/ContractSourceViewer.vue';

type LookupState = 'idle' | 'loading' | 'found' | 'notFound' | 'error';

const LOOKUP_DEBOUNCE_MS = 400;

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();
const toastManager = ToastManager.inject();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const identifier = ref('');
const nickname = ref('');
const abiFile = ref<{ meta: File; content: Uint8Array; loadPercentage: number } | null>(null);
const uploadedAbi = ref<AbiItem[] | null>(null);
const abiError = ref('');

const lookupState = ref<LookupState>('idle');
const verifying = ref(false);
const resolved = ref<ContractInfo | null>(null);
const verified = ref<VerifiedContract | null>(null);

let lookupTimer: ReturnType<typeof setTimeout> | null = null;
let lookupController: AbortController | null = null;

/* Computed */
const trimmedIdentifier = computed(() => identifier.value.trim());
// Detect which kind of identifier was typed, so a single field can serve both. Validity (and the
// EVM-address shape, which also accepts bare hex without "0x") is delegated to
// parseContractReference rather than re-declared here - only the contract-id-vs-evm-address
// distinction (needed for save/display branching below) is this component's own concern.
const identifierType = computed<'contractId' | 'evmAddress' | null>(() => {
  if (!parseContractReference(trimmedIdentifier.value)) return null;
  return /^\d+\.\d+\.\d+$/.test(trimmedIdentifier.value) ? 'contractId' : 'evmAddress';
});
const checking = computed(() => lookupState.value === 'loading' || verifying.value);
const showUpload = computed(() => !checking.value && verified.value === null);
const abi = computed<AbiItem[] | null>(() => verified.value?.abi ?? uploadedAbi.value);
// Only read by the template once an ABI is present
const functionCount = computed(() => getAbiFunctions(abi.value!).length);
const canSave = computed(
  () =>
    identifierType.value !== null &&
    !checking.value &&
    lookupState.value !== 'notFound' &&
    abi.value !== null &&
    abiError.value.length === 0,
);

/* Handlers */
const resetLookup = () => {
  if (lookupTimer) clearTimeout(lookupTimer);
  lookupController?.abort();
  lookupTimer = null;
  lookupController = null;
  lookupState.value = 'idle';
  verifying.value = false;
  resolved.value = null;
  verified.value = null;
};

const runLookup = async (value: string) => {
  const controller = new AbortController();
  lookupController = controller;

  try {
    const info = await getContractInfo(value, network.mirrorNodeBaseURL, controller);
    if (controller.signal.aborted) return;

    if (!info) {
      lookupState.value = 'notFound';
      return;
    }

    resolved.value = info;
    lookupState.value = 'found';

    verifying.value = true;
    const result = await getVerifiedContract(network.network, info.evm_address, controller);
    if (controller.signal.aborted) return;
    verified.value = result;
    verifying.value = false;
  } catch {
    if (controller.signal.aborted) return;
    lookupState.value = 'error';
    verifying.value = false;
  }
};

const handleAbiFileUpdate = async (
  file: { meta: File; content: Uint8Array; loadPercentage: number } | null,
) => {
  abiFile.value = file;
  uploadedAbi.value = null;
  abiError.value = '';

  if (!file || file.loadPercentage < 100) {
    return;
  }

  try {
    const text = new TextDecoder().decode(file.content);
    uploadedAbi.value = parseAbiJson(text);
  } catch (error) {
    abiError.value = getErrorMessage(error, 'Failed to parse ABI file');
  }
};

const handleSave = async () => {
  if (!canSave.value || !abi.value) {
    return;
  }

  try {
    if (!isUserLoggedIn(user.personal)) {
      throw new Error('User not logged in');
    }

    // Prefer what the mirror node resolved so both forms are stored; fall back to what was typed
    // when the lookup was unavailable (custom network, offline).
    const typedContractId = identifierType.value === 'contractId' ? trimmedIdentifier.value : null;
    const typedEvmAddress = identifierType.value === 'evmAddress' ? trimmedIdentifier.value : null;

    await add({
      user_id: user.personal.id,
      network: network.network,
      contract_id: resolved.value?.contract_id ?? typedContractId,
      evm_address: resolved.value?.evm_address ?? typedEvmAddress,
      nickname: nickname.value,
      abi: JSON.stringify(abi.value),
      verified: verified.value !== null,
    });

    toastManager.success('Smart contract saved!');
    await router.push({ name: 'smartContracts' });
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to save smart contract'));
  }
};

/* Watchers */
watch([trimmedIdentifier, () => network.network, () => network.mirrorNodeBaseURL], () => {
  resetLookup();

  if (identifierType.value === null) {
    return;
  }

  lookupState.value = 'loading';
  const value = trimmedIdentifier.value;
  lookupTimer = setTimeout(() => runLookup(value), LOOKUP_DEBOUNCE_MS);
});

onBeforeUnmount(resetLookup);
</script>
<template>
  <div class="p-5">
    <div class="flex-column-100 overflow-hidden">
      <div class="d-flex align-items-center flex-shrink-0">
        <AppButton
          type="button"
          color="secondary"
          class="btn-icon-only me-4"
          @click="$router.back()"
          log-label="back-to-smart-contracts"
        >
          <i class="bi bi-arrow-left"></i>
        </AppButton>

        <h2 class="text-title text-bold">Add smart contract</h2>
      </div>
      <div class="d-flex flex-nowrap flex-grow-1 mt-5" style="min-height: 0">
        <form
          class="flex-shrink-0 me-5"
          style="width: min(100%, 28rem)"
          @submit.prevent="handleSave"
        >
          <div class="form-group">
            <label class="form-label"
              >Contract ID or EVM Address <span class="text-danger">*</span></label
            >
            <AppInput
              v-model="identifier"
              :filled="true"
              data-testid="input-smart-contract-identifier"
              placeholder="0.0.1234 or 0x..."
            />
            <p
              v-if="trimmedIdentifier && identifierType === null"
              class="text-danger text-small mt-2"
            >
              Enter a valid Contract ID (0.0.1234) or EVM address (0x followed by 40 hex
              characters).
            </p>
            <p v-else-if="lookupState === 'loading'" class="text-secondary text-small mt-2">
              Looking up contract…
            </p>
            <p v-else-if="lookupState === 'notFound'" class="text-danger text-small mt-2">
              Contract not found on {{ network.network }}.
            </p>
            <p v-else-if="lookupState === 'error'" class="text-warning text-small mt-2">
              Could not look up this contract on the mirror node. You can still add it by uploading
              its ABI.
            </p>
            <p v-else-if="resolved" class="text-secondary text-small mt-2">
              <span v-if="identifierType === 'contractId'"
                >EVM address: {{ resolved.evm_address }}</span
              >
              <span v-else>Contract ID: {{ resolved.contract_id }}</span>
              <span v-if="resolved.deleted" class="text-danger ms-2"
                >(this contract is deleted)</span
              >
            </p>
            <p v-else class="text-secondary text-small mt-2">
              Enter a Contract ID (e.g. 0.0.1234) or an EVM address (e.g. 0x...).
            </p>
          </div>
          <div class="form-group mt-5">
            <label class="form-label">Nickname</label>
            <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
          </div>
          <div class="form-group mt-5">
            <label class="form-label"
              >Contract ABI <span v-if="showUpload" class="text-danger">*</span></label
            >
            <p v-if="checking" class="text-secondary text-small">Checking for verified source…</p>
            <template v-else-if="verified">
              <p class="text-success text-small" data-testid="text-contract-verified">
                <i class="bi bi-patch-check-fill me-1"></i>Verified on Sourcify ({{
                  verified.match === 'exact_match' ? 'exact match' : 'match'
                }}). Found {{ functionCount }} function{{ functionCount === 1 ? '' : 's' }}.
              </p>
            </template>
            <template v-else>
              <div>
                <AppUploadFile
                  id="smart-contract-abi-upload"
                  :file="abiFile"
                  :max-size-kb="2048"
                  accept=".json"
                  show-name
                  @update:file="handleAbiFileUpdate"
                />
              </div>
              <p v-if="abiError" class="text-danger text-small mt-2">{{ abiError }}</p>
              <p v-else-if="uploadedAbi" class="text-success text-small mt-2">
                Found {{ functionCount }} function{{ functionCount === 1 ? '' : 's' }} in the ABI.
              </p>
              <p v-else class="text-secondary text-small mt-2">
                <template v-if="resolved">This contract is not verified. </template>Upload a raw ABI
                JSON array, or a build artifact (Foundry, Hardhat, Remix) containing an "abi" field.
              </p>
            </template>
          </div>
          <AppButton
            color="primary"
            data-testid="button-save-smart-contract"
            type="submit"
            class="mt-5"
            :disabled="!canSave"
            log-label="add-smart-contract"
            :log-metadata="{ identifier: trimmedIdentifier }"
            >Save</AppButton
          >
        </form>

        <div
          v-if="verified && verified.sources.length > 0"
          class="flex-grow-1 d-flex flex-column"
          style="min-height: 0; min-width: 0"
        >
          <h3 class="text-subheader text-bold mb-3 flex-shrink-0">
            {{ verified.name || 'Contract' }} source code
          </h3>
          <ContractSourceViewer
            class="flex-grow-1"
            :contract-name="verified.name"
            :sources="verified.sources"
          />
        </div>
      </div>
    </div>
  </div>
</template>
