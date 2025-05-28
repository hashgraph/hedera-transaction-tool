<script setup lang="ts">
import type { ITransactionFull } from '@main/shared/interfaces';

import { onBeforeMount, ref } from 'vue';

import {
  Transaction,
  NodeCreateTransaction,
  NodeUpdateTransaction,
  NodeDeleteTransaction,
  KeyList,
  PublicKey,
} from '@hashgraph/sdk';

import { getEndpointData, uint8ToHex } from '@renderer/utils';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* State */
const isKeyStructureModalShown = ref(false);

/* Hooks */
onBeforeMount(async () => {
  if (
    !(
      props.transaction instanceof NodeCreateTransaction ||
      props.transaction instanceof NodeUpdateTransaction ||
      props.transaction instanceof NodeDeleteTransaction
    )
  ) {
    throw new Error('Transaction is not Node Create, Update, Delete');
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
      transaction instanceof NodeCreateTransaction ||
      transaction instanceof NodeUpdateTransaction ||
      transaction instanceof NodeDeleteTransaction
    "
    class="mt-5 row flex-wrap"
  >
    <!-- Node ID -->
    <div
      v-if="
        transaction instanceof NodeUpdateTransaction || transaction instanceof NodeDeleteTransaction
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Node ID</h4>
      <p :class="detailItemValueClass" data-testid="p-node-details-node-id">
        {{ transaction.nodeId.toString() }}
      </p>
    </div>

    <template
      v-if="
        transaction instanceof NodeCreateTransaction || transaction instanceof NodeUpdateTransaction
      "
    >
      <!-- Node Account ID -->
      <div v-if="transaction.accountId" :class="commonColClass">
        <h4 :class="detailItemLabelClass">Node Account ID</h4>
        <p :class="detailItemValueClass" data-testid="p-node-details-node-account-id">
          {{ transaction.accountId.toString() }}
        </p>
      </div>

      <!-- Admin Key -->
      <div v-if="transaction.adminKey" class="col-12 my-3">
        <h4 :class="detailItemLabelClass">Admin Key</h4>
        <p :class="detailItemValueClass" data-testid="p-node-details-admin-key">
          <template v-if="transaction.adminKey instanceof KeyList && true">
            <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
              >See details</span
            >
          </template>
          <template v-else-if="transaction.adminKey instanceof PublicKey && true">
            <p class="overflow-hidden">
              <span class="text-semi-bold text-pink">
                {{ transaction.adminKey._key._type }}
              </span>
              {{ transaction.adminKey.toStringRaw() }}
            </p>
          </template>
          <template v-else>None</template>
        </p>
      </div>

      <!-- Decline Reward - Displayed in the reverse -->
      <div
        v-if="
          transaction instanceof NodeCreateTransaction ||
          transaction.declineReward !== null
        "
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Accept Node Rewards</h4>
        <p :class="detailItemValueClass">
          {{ transaction.declineReward ? 'No' : 'Yes' }}
        </p>
      </div>

      <!-- Gossip Endpoints -->
      <div
        v-if="transaction.gossipEndpoints && transaction.gossipEndpoints.length > 0"
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Gossip Endpoints</h4>
        <table class="table-custom">
          <thead class="thin">
            <tr>
              <th class="text-start">IP Address</th>
              <th class="text-start">Port</th>
              <th class="text-start">Domain Name</th>
            </tr>
          </thead>
          <tbody class="thin">
            <tr
              v-for="(endpoint, index) of getEndpointData(transaction.gossipEndpoints)"
              :key="index"
            >
              <td class="col text-start">{{ endpoint.ipAddressV4 }}</td>
              <td class="col text-start">{{ endpoint.port }}</td>
              <td class="col text-start">{{ endpoint.domainName }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Service Endpoints -->
      <div
        v-if="transaction.serviceEndpoints && transaction.serviceEndpoints.length > 0"
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Service Endpoints</h4>
        <table class="table-custom">
          <thead class="thin">
            <tr>
              <th class="text-start">IP Address</th>
              <th class="text-start">Port</th>
              <th class="text-start">Domain Name</th>
            </tr>
          </thead>
          <tbody class="thin">
            <tr
              v-for="(endpoint, index) of getEndpointData(transaction.serviceEndpoints)"
              :key="index"
            >
              <td class="col text-start">{{ endpoint.ipAddressV4 }}</td>
              <td class="col text-start">{{ endpoint.port }}</td>
              <td class="col text-start">{{ endpoint.domainName }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Gossip CA Certificate -->
      <div
        v-if="transaction.gossipCaCertificate && transaction.gossipCaCertificate.length > 0"
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Gossip CA Certificate</h4>
        <p :class="detailItemValueClass" class="text-break">
          {{ uint8ToHex(transaction.gossipCaCertificate) }}
        </p>
      </div>

      <!-- Certificate Hash -->
      <div
        v-if="transaction.certificateHash && transaction.certificateHash.length > 0"
        class="col-12 my-3"
      >
        <h4 :class="detailItemLabelClass">Certificate Hash</h4>
        <p :class="detailItemValueClass" class="text-break">
          {{ uint8ToHex(transaction.certificateHash) }}
        </p>
      </div>

      <KeyStructureModal
        v-if="transaction.adminKey"
        v-model:show="isKeyStructureModalShown"
        :account-key="transaction.adminKey"
      />
    </template>
  </div>
</template>
