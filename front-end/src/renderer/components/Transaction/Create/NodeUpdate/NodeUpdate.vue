<script setup lang="ts">
import type { INodeInfoParsed } from '@main/shared/interfaces';
import type { NodeUpdateData } from '@renderer/utils/sdk/createTransactions';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';

import { computed, reactive, ref, watch } from 'vue';
import { Key, KeyList, NodeUpdateTransaction, Transaction } from '@hashgraph/sdk';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useNodeId from '@renderer/composables/useNodeId';

import { createNodeUpdateTransaction } from '@renderer/utils/sdk/createTransactions';
import { getNodeUpdateData, isAccountId } from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeUpdateFormData from '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdateFormData.vue';

/* Composables */
const route = useRoute();
const toast = useToast();
const nodeData = useNodeId();
const newNodeAccountData = useAccountId();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<NodeUpdateData>({
  nodeAccountId: '',
  nodeId: '',
  description: '',
  gossipEndpoints: [],
  serviceEndpoints: [],
  gossipCaCertificate: new Uint8Array(),
  gossipCaCertificateText: '',
  certificateHash: '',
  adminKey: null,
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createNodeUpdateTransaction(
      {
        ...common,
        ...(data as NodeUpdateData),
      },
      (nodeData.nodeInfo?.value as INodeInfoParsed) || null,
    );
});

const transactionKey = computed(() => {
  const keys: Key[] = [];

  const oldAccountId = nodeData.nodeInfo?.value?.node_account_id?.toString()?.trim();
  if (isAccountId(data.nodeAccountId) && oldAccountId !== data.nodeAccountId.trim()) {
    nodeData.accountData.key.value && keys.push(nodeData.accountData.key.value);
    newNodeAccountData.key.value && keys.push(newNodeAccountData.key.value);
  }

  data.adminKey && keys.push(data.adminKey);
  nodeData.key.value && keys.push(nodeData.key.value);

  return new KeyList(keys);
});

/* Handlers */
async function handleDraftLoaded(transaction: Transaction) {
  if (transaction instanceof NodeUpdateTransaction) {
    if (transaction.nodeId) {
      nodeData.nodeId.value = transaction.nodeId.toNumber();
    }
    if (transaction.accountId) {
      newNodeAccountData.accountId.value = transaction.accountId.toString();
    }
  }
  handleUpdateData(await getNodeUpdateData(transaction));
  console.log(data.gossipCaCertificate.length);
}

async function handleDetailsLoaded(details: string) {
  handleUpdateData({ ...data, certificateHash: details });
}

const handleUpdateData = (newData: NodeUpdateData) => {
  nodeData.nodeId.value = parseInt(newData.nodeId);
  newNodeAccountData.accountId.value = newData.nodeAccountId;
  Object.assign(data, newData);
  console.log(data.gossipCaCertificate.length);
};

const handleExecutedSuccess = async () => {
  toast.success(`Node ${data.nodeAccountId} Updated`);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.nodeId) {
    throw new Error('Node ID Required');
  }
};

/* Watchers */
watch(nodeData.nodeInfo, nodeInfo => {
  if (!nodeInfo) {
    data.nodeAccountId = '';
    newNodeAccountData.accountId.value = '';
    data.description = '';
    data.gossipEndpoints = [];
    data.serviceEndpoints = [];
    data.gossipCaCertificate = data.gossipCaCertificate;
    data.certificateHash = '';
    data.adminKey = null;
  } else if (!route.query.draftId) {
    data.nodeAccountId = nodeInfo.node_account_id?.toString() || '';
    newNodeAccountData.accountId.value = data.nodeAccountId;
    data.description = nodeInfo.description || '';
    data.gossipEndpoints = [];
    data.serviceEndpoints = [];
    data.gossipCaCertificate = data.gossipCaCertificate;
    data.certificateHash = '';
    data.adminKey = nodeInfo.admin_key;
  }
});
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :transaction-base-key="transactionKey"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
    @details-loaded="handleDetailsLoaded"
    :details="data.certificateHash"
  >
    <template #default>
      <NodeUpdateFormData :data="data as NodeUpdateData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
