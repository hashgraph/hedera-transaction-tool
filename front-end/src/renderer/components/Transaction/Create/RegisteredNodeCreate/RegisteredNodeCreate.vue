<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type {
  ComponentRegisteredServiceEndpoint,
  RegisteredNodeData,
} from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref, watch } from 'vue';
import { Transaction } from '@hiero-ledger/sdk';

import { ToastManager } from '@renderer/utils/ToastManager';

import useUserStore from '@renderer/stores/storeUser';

import { exceedsUtf8ByteLimit, getRegisteredNodeData, isUserLoggedIn } from '@renderer/utils';
import {
  createRegisteredNodeCreateTransaction,
  parseIpv4ToBytes,
  parsePort,
} from '@renderer/utils/sdk/createTransactions';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import RegisteredNodeFormData from './RegisteredNodeFormData.vue';

/* HIP-1137 limits — enforced by the consensus node, mirrored here so we never
   send a request that we already know will be rejected. */
const MAX_SERVICE_ENDPOINTS = 50;
const MAX_DESCRIPTION_BYTES = 100;

/* Stores */
const user = useUserStore();

/* Composables */
const toastManager = ToastManager.inject();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<RegisteredNodeData>({
  description: '',
  adminKey: null,
  serviceEndpoints: [],
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createRegisteredNodeCreateTransaction({
      ...common,
      ...(data as RegisteredNodeData),
    });
});

const createDisabled = computed(() => {
  return !data.adminKey || data.serviceEndpoints.length === 0;
});

/**
 * `uiId` is a render-side stable key for `<EndpointRow>` (see Vue's list `:key`
 * rules — never use `index` for editable lists). It lives in the form's data
 * model but must NEVER leak into the SDK-serialized transaction OR into the
 * shape returned by `getRegisteredNodeData` (which is JSON-stringified by
 * `transactionsDataMatch`). So `getRegisteredNodeData` deliberately doesn't
 * populate `uiId`, and we decorate endpoints with a fresh UUID *only at form
 * intake* — preserving any uiId the user/Vue already has for that row.
 */
const makeUiId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const decorateEndpointsWithUiIds = (
  endpoints: ComponentRegisteredServiceEndpoint[],
): ComponentRegisteredServiceEndpoint[] =>
  endpoints.map(ep => (ep.uiId ? ep : { ...ep, uiId: makeUiId() }));

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getRegisteredNodeData(transaction));
};

const handleUpdateData = (newData: RegisteredNodeData) => {
  Object.assign(data, {
    ...newData,
    serviceEndpoints: decorateEndpointsWithUiIds(newData.serviceEndpoints),
  });
};

const handleExecutedSuccess = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  toastManager.success('Registered Node Created');
};

/* Functions */
const preCreateAssert = () => {
  if (!data.adminKey) {
    throw new Error('Admin Key Required');
  }

  if (data.serviceEndpoints.length === 0) {
    throw new Error('At least one Service Endpoint is required');
  }

  if (data.serviceEndpoints.length > MAX_SERVICE_ENDPOINTS) {
    throw new Error(`A registered node may have at most ${MAX_SERVICE_ENDPOINTS} service endpoints`);
  }

  if (data.description && exceedsUtf8ByteLimit(data.description, MAX_DESCRIPTION_BYTES)) {
    throw new Error(`Description must be ≤ ${MAX_DESCRIPTION_BYTES} bytes`);
  }

  data.serviceEndpoints.forEach((ep, i) => {
    if (!ep.type) {
      throw new Error(`Endpoint ${i + 1}: type is required`);
    }
    const hasIp = Boolean(ep.ipAddressV4?.trim());
    const hasDomain = Boolean(ep.domainName?.trim());
    if (!hasIp && !hasDomain) {
      throw new Error(`Endpoint ${i + 1}: IP address or domain name is required`);
    }
    if (hasIp && hasDomain) {
      throw new Error(`Endpoint ${i + 1}: cannot have both IP and domain`);
    }
    if (hasIp && parseIpv4ToBytes(ep.ipAddressV4 ?? '') === null) {
      throw new Error(`Endpoint ${i + 1}: invalid IPv4 address`);
    }
    if (parsePort(ep.port ?? '') === null) {
      throw new Error(`Endpoint ${i + 1}: port must be a number in [0, 65535]`);
    }
    if (
      ep.type === 'generalService' &&
      ep.endpointDescription &&
      exceedsUtf8ByteLimit(ep.endpointDescription, MAX_DESCRIPTION_BYTES)
    ) {
      throw new Error(
        `Endpoint ${i + 1}: description must be ≤ ${MAX_DESCRIPTION_BYTES} bytes`,
      );
    }
  });

  return true;
};

/* Watchers */
// Only fields that change the network-required *signer set* should trigger
// `updateTransactionKey()` — which performs a mirror-node round trip via
// `appCache.computeSignatureKey`. For RegisteredNodeCreate, the signer rule
// (per HIP-1137) is "the new `admin_key` must sign", so only `data.adminKey`
// affects the recompute. Endpoint fields (IP, port, TLS, type) and the
// description never change who has to sign. Matches `NodeCreate.vue`'s
// narrow watcher shape — a deep watcher here would issue a network call on
// every keystroke into every endpoint field.
watch(
  () => data.adminKey,
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>

<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <RegisteredNodeFormData
        :data="data as RegisteredNodeData"
        @update:data="handleUpdateData"
        required
      />
    </template>
  </BaseTransaction>
</template>
