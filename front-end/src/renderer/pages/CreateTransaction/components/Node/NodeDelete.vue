<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { computed, onMounted, ref, watch } from 'vue';
import {
  NodeDeleteTransaction,
  Hbar,
  Transaction,
  TransactionReceipt,
  Key,
  KeyList,
  TransactionResponse,
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

import { isAccountId } from '@renderer/utils';
import { getTransactionFromBytes, getPropagationButtonLabel } from '@renderer/utils/transactions';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import AddToGroupModal from '@renderer/components/AddToGroupModal.vue';

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

const nodeId = ref('');
const ownerKey = ref<Key | null>(null);
const isExecuted = ref(false);
const isSubmitted = ref(false);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const transactionName = ref('');
const transactionDescription = ref('');
const transactionMemo = ref('');

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

    if (!nodeId.value) {
      throw new Error('Node Account ID Required');
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

    toast.success(`Node Delete Transaction Executed`, { position: 'bottom-right' });
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
    const draftTransaction = getTransactionFromBytes<NodeDeleteTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    if (draftTransaction.nodeId != null) {
      nodeId.value = draftTransaction.nodeId.toString();
    }
  }
};

const handleOwnerKeyUpdate = (key: Key) => {
  ownerKey.value = key;
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

async function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  if (!ownerKey.value) {
    throw new Error('Owner key is required');
  }
  const transactionBytes = (await createTransaction()).toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'NodeDeleteTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

async function handleEditGroupItem() {
  const transactionBytes = (await createTransaction()).toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'NodeDeleteTransaction',
    accountId: '',
    seq: route.params.seq[0],
    groupId: transactionGroup.groupItems[Number(route.query.groupIndex)].groupId,
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

/* Functions */
const createTransaction = () => {
  const transaction = new NodeDeleteTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setNodeId(nodeId.value);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
};

function formatNodeId(event: Event) {
  const target = event.target as HTMLInputElement;
  const v = target.value.replace(/[^0-9]/g, '');
  nodeId.value = v;
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
      <TransactionHeaderControls heading-text="Node Delete Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :description="transactionDescription"
              :is-executed="isExecuted || isSubmitted"
              :get-transaction="() => createTransaction().toBytes()"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit"
              :disabled="!ownerKey || !payerData.isValid.value"
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
            <label class="form-label">Node ID <span class="text-danger">*</span></label>
            <input
              v-model="nodeId"
              @input="formatNodeId"
              maxlength="1"
              class="form-control is-fill"
              placeholder="Enter Node ID"
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
