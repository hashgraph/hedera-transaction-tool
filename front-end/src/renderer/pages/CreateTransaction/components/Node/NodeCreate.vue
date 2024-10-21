<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  NodeCreateTransaction,
  Hbar,
  Transaction,
  TransactionReceipt,
  Key,
  KeyList,
  TransactionResponse,
  ServiceEndpoint,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute, useRouter } from 'vue-router';

import { createTransactionId } from '@renderer/utils/sdk/createTransactions';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { isAccountId, formatAccountId } from '@renderer/utils';
import { getTransactionFromBytes, getPropagationButtonLabel } from '@renderer/utils/transactions';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import AddToGroupModal from '@renderer/components/AddToGroupModal.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import { hexToUint8Array, uint8ArrayToHex } from '@renderer/services/electronUtilsService';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

interface componentServiceEndpoint {
  ipAddressV4: string | null;
  port: string;
  domainName: string | null;
}

const nodeData = reactive<{
  nodeAccountId: string;
  description: string;
  gossipEndpoints: componentServiceEndpoint[];
  serviceEndpoints: componentServiceEndpoint[];
  gossipCaCertificate: string;
  certificateHash: string;
  adminKey: Key | null;
}>({
  nodeAccountId: '',
  description: '',
  gossipEndpoints: [],
  serviceEndpoints: [],
  gossipCaCertificate: '',
  certificateHash: '',
  adminKey: null,
});
const ownerKey = ref<Key | null>(null);
const isExecuted = ref(false);
const isSubmitted = ref(false);
const gossipIpAddressV4 = ref('');
const serviceIpAddressV4 = ref('');
const gossipPort = ref('');
const servicePort = ref('');
const gossipDomainName = ref('');
const serviceDomainName = ref('');

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const transactionName = ref('');
const transactionDescription = ref('');
const transactionMemo = ref('');

const ipRegex =
  /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];
  payerData.key.value && keyList.push(payerData.key.value);

  return new KeyList(keyList);
});

/* Handlers */

async function handleCreate(e: Event) {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw new Error('Invalid Payer ID');
    }

    if (!ownerKey.value) {
      throw new Error('Owner key is required');
    }

    if (!nodeData.nodeAccountId) {
      throw new Error('Node Account ID Required');
    }

    if (!nodeData.gossipEndpoints) {
      throw new Error('Gossip Endpoints Required');
    }

    if (!nodeData.serviceEndpoints) {
      throw new Error('Service Endpoints Required');
    }

    if (!nodeData.gossipCaCertificate) {
      throw new Error('Gossip CA Certificate Required');
    }

    if (!nodeData.adminKey) {
      throw new Error('Admin Key Required');
    }

    transaction.value = await createTransaction();
    await transactionProcessor.value?.process(
      {
        transactionKey: transactionKey.value,
        transactionBytes: transaction.value.toBytes(),
        name: transactionName.value,
        description: transactionDescription.value,
      },
      observers.value,
      approvers.value,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
}

async function handleExecuted(
  success: boolean,
  _response: TransactionResponse | null,
  receipt: TransactionReceipt | null,
) {
  isExecuted.value = true;

  if (success && receipt) {
    if (!isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in');
    }

    toast.success(`Node Create Transaction Executed`, { position: 'bottom-right' });
  }
}

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId && !route.query.groupIndex) return;
  let draftTransactionBytes: string | null = null;
  if (!route.query.group) {
    const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
    draftTransactionBytes = draft.transactionBytes;
  } else if (route.query.groupIndex) {
    draftTransactionBytes =
      transactionGroup.groupItems[Number(route.query.groupIndex)].transactionBytes.toString();
  }

  if (draftTransactionBytes) {
    const draftTransaction = getTransactionFromBytes<NodeCreateTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    if (draftTransaction.accountId != null) {
      nodeData.nodeAccountId = draftTransaction.accountId.toString();
    }
    if (draftTransaction.description != null) {
      nodeData.description = draftTransaction.description;
    }
    if (draftTransaction.gossipEndpoints != null) {
      for (const endpoint of draftTransaction.gossipEndpoints) {
        if (endpoint.getPort) {
          nodeData.gossipEndpoints.push({
            ipAddressV4:
              endpoint.getIpAddressV4 != null
                ? hexToString(await uint8ArrayToHex(endpoint.getIpAddressV4))
                : null,
            port: endpoint.getPort?.toString(),
            domainName: endpoint.getDomainName != null ? endpoint.getDomainName : null,
          });
        }
      }
    }
    if (draftTransaction.serviceEndpoints != null) {
      for (const endpoint of draftTransaction.serviceEndpoints) {
        if (endpoint.getPort) {
          nodeData.serviceEndpoints.push({
            ipAddressV4:
              endpoint.getIpAddressV4 != null
                ? hexToString(await uint8ArrayToHex(endpoint.getIpAddressV4))
                : null,
            port: endpoint.getPort?.toString(),
            domainName: endpoint.getDomainName != null ? endpoint.getDomainName : null,
          });
        }
      }
    }

    if (draftTransaction.gossipCaCertificate != null) {
      nodeData.gossipCaCertificate = await uint8ArrayToHex(draftTransaction.gossipCaCertificate);
    }

    if (draftTransaction.adminKey != null) {
      nodeData.adminKey = draftTransaction.adminKey;
    }
  }
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

async function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  const transactionBytes = (await createTransaction()).toBytes();

  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'NodeCreateTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    keyList: [],
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

async function handleEditGroupItem() {
  const transactionBytes = (await createTransaction()).toBytes();

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'NodeCreateTransaction',
    accountId: '',
    seq: route.params.seq[0],
    groupId: transactionGroup.groupItems[Number(route.query.groupIndex)].groupId,
    keyList: [],
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

function handleAddGossipEndpoint() {
  if (gossipIpAddressV4.value && gossipDomainName.value) {
    throw new Error('Either IP Address or Domain Name can be entered, but not both');
  }
  nodeData.gossipEndpoints.push({
    ipAddressV4: gossipIpAddressV4.value,
    port: gossipPort.value,
    domainName: gossipDomainName.value,
  });
  gossipIpAddressV4.value = '';
  gossipPort.value = '';
  gossipDomainName.value = '';
}

function handleAddServiceEndpoint() {
  if (serviceIpAddressV4.value && serviceDomainName.value) {
    throw new Error('Either IP Address or Domain Name can be entered, but not both');
  }
  nodeData.serviceEndpoints.push({
    ipAddressV4: serviceIpAddressV4.value,
    port: servicePort.value,
    domainName: serviceDomainName.value,
  });
  serviceIpAddressV4.value = '';
  servicePort.value = '';
  serviceDomainName.value = '';
}

/* Functions */
const createTransaction = async () => {
  const txGossipEndpoints = new Array<ServiceEndpoint>();
  const txServiceEndpoints = new Array<ServiceEndpoint>();
  // FIXME: Endpoints can have either ipAddress or Domain name, not both
  for (const serviceEndpoint of nodeData.gossipEndpoints) {
    let newServiceEndpoint;
    if (serviceEndpoint.ipAddressV4 != null) {
      newServiceEndpoint = new ServiceEndpoint()
        .setIpAddressV4(await hexToUint8Array(stringToHex(serviceEndpoint.ipAddressV4)))
        .setPort(Number.parseInt(serviceEndpoint.port));
    } else if (serviceEndpoint.domainName != null) {
      newServiceEndpoint = new ServiceEndpoint()
        .setPort(Number.parseInt(serviceEndpoint.port))
        .setDomainName(serviceEndpoint.domainName);
    }
    if (newServiceEndpoint) {
      txGossipEndpoints.push(newServiceEndpoint);
    }
  }
  for (const serviceEndpoint of nodeData.serviceEndpoints) {
    let newServiceEndpoint;
    if (serviceEndpoint.ipAddressV4 != null) {
      newServiceEndpoint = new ServiceEndpoint()
        .setIpAddressV4(await hexToUint8Array(stringToHex(serviceEndpoint.ipAddressV4)))
        .setPort(Number.parseInt(serviceEndpoint.port));
    } else if (serviceEndpoint.domainName != null) {
      newServiceEndpoint = new ServiceEndpoint()
        .setPort(Number.parseInt(serviceEndpoint.port))
        .setDomainName(serviceEndpoint.domainName);
    }
    if (newServiceEndpoint) {
      txServiceEndpoints.push(newServiceEndpoint);
    }
  }

  const transaction = new NodeCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setAccountId(nodeData.nodeAccountId)
    .setDescription(nodeData.description)
    // For Endpoints, copy transfer list format for now in ui
    .setGossipEndpoints(txGossipEndpoints)
    .setServiceEndpoints(txServiceEndpoints)
    .setGossipCaCertificate(await hexToUint8Array(nodeData.gossipCaCertificate))
    // CertHash Optional
    // String to uint8array OR Pem file upload to uint8array
    .setCertificateHash(await hexToUint8Array(nodeData.certificateHash));

  if (nodeData.adminKey) {
    // Optional Admin Key
    transaction.setAdminKey(nodeData.adminKey);
  }

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
};

function stringToHex(str: string): string {
  return Array.from(str, c => c.charCodeAt(0).toString(16)).join('');
}

function hexToString(hex: string) {
  return decodeURIComponent(hex.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
}

function formatServiceIpAddress(event: Event) {
  const target = event.target as HTMLInputElement;
  const v = target.value;

  const octets = v.split('.');

  const newOctets = octets.map(octet => {
    if (octet === '') {
      return '';
    }
    const n = Number.parseInt(octet);
    if (!isNaN(n) && n >= 0 && n <= 255) {
      return n.toString();
    } else {
      return n.toString().slice(0, 3);
    }
  });

  if (newOctets.length > 4) {
    newOctets.pop();
  }

  if (newOctets.length <= 4) {
    serviceIpAddressV4.value = newOctets.join('.');
  }
}

function formatGossipIpAddress(event: Event) {
  const target = event.target as HTMLInputElement;
  const v = target.value;

  const octets = v.split('.');

  const newOctets = octets.map(octet => {
    if (octet === '') {
      return '';
    }
    const n = Number.parseInt(octet);
    if (!isNaN(n) && n >= 0 && n <= 255) {
      return n.toString();
    } else {
      return n.toString().slice(0, 3);
    }
  });

  if (newOctets.length > 4) {
    newOctets.pop();
  }

  if (newOctets.length <= 4) {
    gossipIpAddressV4.value = newOctets.join('.');
  }
}

function formatGossipPort(event: Event) {
  const target = event.target as HTMLInputElement;
  const v = target.value.replace(/[^0-9]/g, '');
  gossipPort.value = v;
}

function formatServicePort(event: Event) {
  const target = event.target as HTMLInputElement;
  const v = target.value.replace(/[^0-9]/g, '');
  gossipPort.value = v;
}

const redirectToDetails = async (id: string | number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Watchers */
watch(payerData.isValid, isValid => {
  if (
    isValid &&
    payerData.key.value &&
    !ownerKey.value &&
    !router.currentRoute.value.query.draftId
  ) {
    ownerKey.value = payerData.key.value;
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Node Create Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :description="transactionDescription"
              :is-executed="isExecuted || isSubmitted"
              :get-node-transaction="() => createTransaction()"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit"
              :disabled="!payerData.isValid.value"
            >
              <span class="bi bi-send"></span>
              {{
                getPropagationButtonLabel(
                  transactionKey,
                  user.keyPairs,
                  Boolean(user.selectedOrganization),
                )
              }}</AppButton
            >
          </div>
          <div v-else>
            <AppButton
              v-if="$route.params.seq"
              color="primary"
              type="button"
              @click="handleEditGroupItem"
            >
              <span class="bi bi-plus-lg" />
              Edit Group Item
            </AppButton>
            <AppButton v-else color="primary" type="button" @click="handleAddToGroup">
              <span class="bi bi-plus-lg" />
              Add to Group
            </AppButton>
          </div>
        </template>
      </TransactionHeaderControls>

      <div class="fill-remaining">
        <TransactionInfoControls
          v-model:name="transactionName"
          v-model:description="transactionDescription"
        />

        <TransactionIdControls
          v-model:payer-id="payerData.accountId.value"
          v-model:valid-start="validStart"
          v-model:max-transaction-fee="maxTransactionFee as Hbar"
        />

        <hr class="separator my-5" />

        <div class="row align-items-end">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Node Account ID <span class="text-danger">*</span></label>
            <AppInput
              :model-value="nodeData.nodeAccountId?.toString()"
              @update:model-value="v => (nodeData.nodeAccountId = formatAccountId(v))"
              :filled="true"
              placeholder="Enter Node Account ID"
            />
          </div>
        </div>

        <div class="row align-items-end mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Node Description</label>
            <AppInput
              :model-value="nodeData.description"
              @update:model-value="v => nodeData.description"
              :filled="true"
              placeholder="Enter Node Description"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <label class="form-label">Gossip Endpoints <span class="text-danger">*</span></label>
        <div class="d-flex">
          <div class="col">
            <label class="form-label">IP Address</label>
            <input
              v-model="gossipIpAddressV4"
              @input="formatGossipIpAddress"
              class="form-control is-fill"
              placeholder="Enter IP Address"
            />
          </div>
          <div class="mx-5 col-2">
            <label class="form-label">Port</label>
            <input
              v-model="gossipPort"
              @input="formatGossipPort"
              class="form-control is-fill"
              placeholder="Enter Port"
            />
          </div>
          <div class="col mx-5">
            <label class="form-label">Domain Name</label>
            <AppInput
              :model-value="gossipDomainName"
              @update:model-value="v => (gossipDomainName = v)"
              :filled="true"
              placeholder="Enter Domain Name"
            />
          </div>
          <AppButton
            color="primary"
            type="button"
            class="align-self-end"
            @click="handleAddGossipEndpoint"
            >Add Gossip Endpoint
          </AppButton>
        </div>

        <ul class="mt-5">
          <li class="d-flex">
            <label class="form-label col text-center">IP Address</label>
            <label class="form-label mx-5 col text-center">Port</label>
            <label class="form-label col text-center">Domain Name</label>
          </li>
          <li v-for="(endpoint, index) of nodeData.gossipEndpoints" :key="index" class="d-flex">
            <div class="col text-center">{{ endpoint.ipAddressV4 }}</div>
            <div class="col text-center">{{ endpoint.port }}</div>
            <div class="col text-center">{{ endpoint.domainName }}</div>
          </li>
        </ul>

        <hr class="separator my-5" />

        <label class="form-label">Service Endpoints <span class="text-danger">*</span></label>
        <div class="d-flex">
          <div class="col">
            <label class="form-label">IP Address</label>
            <input
              v-model="serviceIpAddressV4"
              @input="formatServiceIpAddress"
              class="form-control is-fill"
              placeholder="Enter IP Address"
            />
          </div>
          <div class="mx-5 col-2">
            <label class="form-label">Port</label>
            <input
              v-model="servicePort"
              @input="formatServicePort"
              class="form-control is-fill"
              placeholder="Enter Port"
            />
          </div>
          <div class="col mx-5">
            <label class="form-label">Domain Name</label>
            <AppInput
              :model-value="serviceDomainName"
              @update:model-value="v => (serviceDomainName = v)"
              :filled="true"
              placeholder="Enter Domain Name"
            />
          </div>
          <AppButton
            color="primary"
            type="button"
            class="align-self-end"
            @click="handleAddServiceEndpoint"
            >Add Service Endpoint
          </AppButton>
        </div>

        <ul class="mt-5">
          <li class="d-flex">
            <label class="form-label col text-center">IP Address</label>
            <label class="form-label mx-5 col text-center">Port</label>
            <label class="form-label col text-center">Domain Name</label>
          </li>
          <li v-for="(endpoint, index) of nodeData.serviceEndpoints" :key="index" class="d-flex">
            <div class="col text-center">{{ endpoint.ipAddressV4 }}</div>
            <div class="col text-center">{{ endpoint.port }}</div>
            <div class="col text-center">{{ endpoint.domainName }}</div>
          </li>
        </ul>

        <hr class="separator my-5" />

        <div class="row align-items-end mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label"
              >Gossip CA Certificate <span class="text-danger">*</span></label
            >
            <AppInput
              :model-value="nodeData.gossipCaCertificate"
              @update:model-value="v => (nodeData.gossipCaCertificate = v)"
              :filled="true"
              placeholder="Enter Gossip CA Certificate"
            />
          </div>
        </div>

        <div class="row align-items-end mt-6">
          <div class="form-group" :class="['col-8 col-xxxl-6']">
            <label class="form-label">GRPC Certificate Hash</label>
            <AppTextArea
              :model-value="nodeData.certificateHash"
              @update:model-value="(v: string) => (nodeData.certificateHash = v)"
              :filled="true"
              placeholder="Enter GRPC Certificate Hash"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              label="Admin Key"
              :model-key="ownerKey"
              @update:model-key="v => (nodeData.adminKey = v)"
              is-required
            />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Observers</label>
            <UsersGroup v-model:userIds="observers" :addable="true" :editable="true" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Approvers</label>
            <ApproversList v-model:approvers="approvers" :editable="true" />
          </div>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-local-stored="redirectToDetails"
    />
    <AddToGroupModal @addToGroup="handleAddToGroup" />
  </div>
</template>
