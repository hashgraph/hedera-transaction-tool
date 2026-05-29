<script setup lang="ts">
import type { ITransactionFull } from '@shared/interfaces';

import { onBeforeMount, ref } from 'vue';

import {
  BlockNodeServiceEndpoint,
  GeneralServiceEndpoint,
  KeyList,
  PublicKey,
  RegisteredNodeCreateTransaction,
  RegisteredNodeUpdateTransaction,
  RegisteredNodeDeleteTransaction,
  Transaction,
} from '@hiero-ledger/sdk';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* State */
const isKeyStructureModalShown = ref(false);

const typeLabel: Record<string, string> = {
  blockNode: 'Block Node',
  mirrorNode: 'Mirror Node',
  rpcRelay: 'RPC Relay',
  generalService: 'General Service',
};

/* Hooks */
onBeforeMount(() => {
  if (
    !(
      props.transaction instanceof RegisteredNodeCreateTransaction ||
      props.transaction instanceof RegisteredNodeUpdateTransaction ||
      props.transaction instanceof RegisteredNodeDeleteTransaction
    )
  ) {
    throw new Error('Transaction is not Registered Node Create');
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>

<template>
  <div class="mt-5 row flex-wrap">
    <!-- Registered Node ID -->
    <div
      v-if="
        transaction instanceof RegisteredNodeUpdateTransaction ||
        transaction instanceof RegisteredNodeDeleteTransaction
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Registered Node ID</h4>
      <p :class="detailItemValueClass" data-testid="p-node-details-node-id">
        {{ transaction.registeredNodeId?.toString() ?? '' }}
      </p>
    </div>

    <template
      v-if="
        transaction instanceof RegisteredNodeCreateTransaction ||
        transaction instanceof RegisteredNodeUpdateTransaction
      "
    >
      <!-- Description -->
      <div v-if="transaction.description" :class="commonColClass">
        <h4 :class="detailItemLabelClass">Description</h4>
        <p :class="detailItemValueClass" data-testid="p-registered-node-details-description">
          {{ transaction.description }}
        </p>
      </div>

      <!-- Admin Key -->
      <div v-if="transaction.adminKey" class="col-12 my-3">
        <h4 :class="detailItemLabelClass">Admin Key</h4>
        <p :class="detailItemValueClass" data-testid="p-registered-node-details-admin-key">
          <template v-if="transaction.adminKey instanceof KeyList">
            <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true">
              See details
            </span>
          </template>
          <template v-else-if="transaction.adminKey instanceof PublicKey">
            <span class="overflow-hidden">
              <span class="text-semi-bold text-pink">
                {{ transaction.adminKey._key._type }}
              </span>
              {{ transaction.adminKey.toStringRaw() }}
            </span>
          </template>
          <template v-else>None</template>
        </p>
      </div>

      <!-- Service Endpoints -->
      <div
        v-if="transaction.serviceEndpoints !== null && transaction.serviceEndpoints.length > 0"
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Service Endpoints</h4>
        <table class="table-custom">
          <thead class="thin">
            <tr>
              <th class="text-start">Type</th>
              <th class="text-start">IP Address</th>
              <th class="text-start">Domain Name</th>
              <th class="text-start">Port</th>
              <th class="text-start">TLS</th>
              <th class="text-start">Extra</th>
            </tr>
          </thead>
          <tbody class="thin">
            <!--
          `:key="index"` is intentional here. The list is rendered read-only
          (no inputs, no focus, no editable state), so Vue's "don't use index
          as key" rule — which exists to avoid swapping DOM around the wrong
          data when items are inserted/deleted/edited — doesn't apply. The
          editable form (`EndpointRow` in RegisteredNodeFormData) uses the
          `uiId`-based key for that reason.
        -->
            <tr v-for="(endpoint, index) of transaction.serviceEndpoints" :key="index">
              <td class="col text-start">{{ typeLabel[endpoint.type] ?? endpoint.type }}</td>
              <td class="col text-start">{{ endpoint.ipAddress }}</td>
              <td class="col text-start">{{ endpoint.domainName }}</td>
              <td class="col text-start">{{ endpoint.port }}</td>
              <td class="col text-start">{{ endpoint.requiresTls ? 'Yes' : 'No' }}</td>
              <td class="col text-start">
                <template v-if="endpoint instanceof BlockNodeServiceEndpoint">
                  {{ (endpoint.endpointApis ?? []).length }} API(s)
                </template>
                <template v-else-if="endpoint instanceof GeneralServiceEndpoint">
                  {{ endpoint.description || '' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <KeyStructureModal
        v-if="transaction.adminKey"
        v-model:show="isKeyStructureModalShown"
        :account-key="transaction.adminKey"
      />
    </template>
  </div>
</template>
