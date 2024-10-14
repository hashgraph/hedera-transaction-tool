<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { ref, watch, onMounted, computed } from 'vue';
import { FileUpdateTransaction, Hbar, Key, KeyList, Transaction } from '@hashgraph/sdk';

import { DISPLAY_FILE_SIZE_LIMIT } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  getPropagationButtonLabel,
  getTransactionFromBytes,
  isAccountId,
  formatAccountId,
  redirectToDetails,
  safeAwait,
} from '@renderer/utils';
import {
  isHederaSpecialFileId,
  getMinimumExpirationTime,
  getMaximumExpirationTime,
} from '@renderer/utils/sdk';
import { createFileUpdateTransaction } from '@renderer/utils/sdk/createTransactions';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppUploadFile from '@renderer/components/ui/AppUploadFile.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import RunningClockDatePicker from '@renderer/components/Wrapped/RunningClockDatePicker.vue';
import AddToGroupModal from '@renderer/components/AddToGroupModal.vue';

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const router = useRouter();
const route = useRoute();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const fileId = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const ownerKey = ref<Key | null>(null);
const newOwnerKey = ref<Key | null>(null);
const removeContent = ref(false);

const file = ref<{
  meta: File;
  content: Uint8Array;
  loadPercentage: number;
} | null>(null);
const displayedFileText = ref<string | null>(null);
const manualContent = ref('');

const isExecuted = ref(false);
const isSubmitted = ref(false);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const transactionMemo = ref('');
const transactionName = ref('');
const transactionDescription = ref('');

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);
  ownerKey.value && keyList.push(ownerKey.value);
  newOwnerKey.value && keyList.push(newOwnerKey.value);

  return new KeyList(keyList);
});

/* Handlers */
const handleFileLoadStart = () => {
  displayedFileText.value = null;
};

const handleFileLoadEnd = async () => {
  await syncDisplayedContent();
};

const handleCreate = async (e: Event) => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(fileId.value)) {
      throw Error('Invalid File ID');
    }

    if (!ownerKey.value && !isLoggedInOrganization(user.selectedOrganization)) {
      throw Error('Signature key is required');
    }

    const newTransaction = createTransaction();

    if (manualContent.value.length > 0) {
      newTransaction.setContents(manualContent.value);
    }
    if (file.value) {
      newTransaction.setContents(file.value.content);
    }

    if (removeContent.value) {
      newTransaction.setContents(new Uint8Array());
    }

    transaction.value = newTransaction;

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
};

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
    const draftTransaction = getTransactionFromBytes<FileUpdateTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    if (draftTransaction.keys) {
      newOwnerKey.value = new KeyList(draftTransaction.keys);
    }

    if (draftTransaction.fileId) {
      fileId.value = draftTransaction.fileId.toString();
    }

    memo.value = draftTransaction.fileMemo || '';
    transactionMemo.value = draftTransaction.transactionMemo || '';

    if (draftTransaction.expirationTime) {
      const expirationDate = draftTransaction.expirationTime.toDate();

      if (
        expirationDate > getMinimumExpirationTime() &&
        expirationDate < getMaximumExpirationTime()
      ) {
        expirationTimestamp.value = expirationDate;
      }
    }
  }
};

const handleExecuted = () => {
  isExecuted.value = true;
};

const handleLocalStored = (id: string) => {
  toast.success('File Update Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(router, id);
};

const handleSubmit = async (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(router, id);
};

/* Functions */
function createTransaction() {
  return createFileUpdateTransaction({
    payerId: payerData.accountId.value,
    validStart: validStart.value,
    maxTransactionFee: maxTransactionFee.value as Hbar,
    transactionMemo: transactionMemo.value,
    fileId: fileId.value,
    ownerKey: ownerKey.value,
    fileMemo: memo.value,
    expirationTime: expirationTimestamp.value ? new Date(expirationTimestamp.value) : null,
    contents: null,
  });
}

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  if (!isAccountId(fileId.value)) {
    throw Error('Invalid File ID');
  }

  if (!ownerKey.value && !isLoggedInOrganization(user.selectedOrganization)) {
    throw Error('Signature key is required');
  }

  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'FileUpdateTransaction',
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

function handleEditGroupItem() {
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'FileUpdateTransaction',
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

async function syncDisplayedContent() {
  if (file.value === null) {
    displayedFileText.value = null;
    return;
  }

  if (file.value && file.value.meta.size > DISPLAY_FILE_SIZE_LIMIT) {
    displayedFileText.value = '';
    return;
  }

  if (isHederaSpecialFileId(fileId.value)) {
    const { data, error } = await safeAwait(
      window.electronAPI.local.files.decodeProto(fileId.value, file.value.content),
    );
    if (error) {
      displayedFileText.value = '';
      throw new Error('Failed to decode file');
    } else if (data) {
      displayedFileText.value = data;
    }
  } else {
    displayedFileText.value = new TextDecoder().decode(file.value.content);
  }
}

/* Hooks */
onMounted(async () => {
  if (router.currentRoute.value.query.fileId) {
    fileId.value = router.currentRoute.value.query.fileId.toString();
  }

  await handleLoadFromDraft();
});

/* Watchers */
watch(manualContent, newContent => {
  if (newContent.length > 0) {
    removeContent.value = false;
  }
});
watch(file, newFile => {
  if (newFile && newFile.content.length > 0) {
    removeContent.value = false;
  }
});
watch(file, () => (manualContent.value = ''));
watch(fileId, async id => {
  if (isHederaSpecialFileId(id) && !file.value?.meta.name.endsWith('.bin')) {
    file.value = null;
    manualContent.value = '';
  }

  await syncDisplayedContent();
});
/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Update File Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :get-transaction-bytes="() => createTransaction().toBytes()"
              :description="transactionDescription"
              :is-executed="isExecuted || isSubmitted"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit-update-file"
              :disabled="
                (!isLoggedInOrganization(user.selectedOrganization) && !ownerKey) ||
                !payerData.isValid.value ||
                !fileId
              "
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

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <TransactionInfoControls
          v-model:name="transactionName"
          v-model:description="transactionDescription"
        />

        <TransactionIdControls
          v-model:payer-id="payerData.accountId.value"
          v-model:valid-start="validStart"
          v-model:max-transaction-fee="maxTransactionFee as Hbar"
          class="mt-6"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              v-model="transactionMemo"
              :filled="true"
              data-testid="input-transaction-memo-for-file-update"
              maxlength="100"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">File ID <span class="text-danger">*</span></label>
            <AppInput
              :model-value="fileId"
              @update:model-value="v => (fileId = formatAccountId(v))"
              :filled="true"
              placeholder="Enter File ID"
              data-testid="input-file-id-for-update"
            />
          </div>
        </div>

        <div v-if="!isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              :model-key="ownerKey"
              @update:model-key="key => (ownerKey = key)"
              is-required
              label="Signature Key"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              :model-key="newOwnerKey"
              @update:model-key="key => (newOwnerKey = key)"
              label="New Key"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Memo</label>
            <AppInput
              v-model="memo"
              type="text"
              :filled="true"
              maxlength="100"
              data-testid="input-file-update-memo"
              placeholder="Enter memo"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-4 col-xxxl-3">
            <label class="form-label"
              >Expiration <span class="text-muted text-italic">- Local time</span></label
            >
            <RunningClockDatePicker
              v-model="expirationTimestamp"
              :now-button-visible="
                new Date() >= getMinimumExpirationTime() && new Date() <= getMaximumExpirationTime()
              "
              data-testid="input-expiration-time-for-file"
              placeholder="Select Expiration Time"
              :min-date="getMinimumExpirationTime()"
              :max-date="getMaximumExpirationTime()"
            />
          </div>
        </div>

        <!-- <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Chunk Size (If File is large)</label>
            <AppInput
              v-model="chunkSize"
              type="number"
              min="1024"
              max="6144"
              :filled="true"
              placeholder="Enter Chunk Size"
            />
          </div>
        </div> -->

        <div class="mt-4 form-group">
          <AppUploadFile
            id="update-transaction-file"
            show-name
            show-progress
            v-model:file="file"
            :accept="isHederaSpecialFileId(fileId) ? '.bin' : '*'"
            :disabled="manualContent.length > 0"
            @load:start="handleFileLoadStart"
            @load:end="handleFileLoadEnd"
          />
        </div>

        <div class="row mt-6">
          <div class="form-group col-12 col-xl-8">
            <label class="form-label"
              >File Contents
              <span v-if="file && file.meta.size > DISPLAY_FILE_SIZE_LIMIT">
                - the content is too big to be displayed</span
              ></label
            >
            <Transition name="fade" mode="out-in">
              <AppCheckBox
                v-if="manualContent.length === 0 && !file"
                v-model:checked="removeContent"
                label="Remove File Contents"
                name="remove-file-contents"
              />
            </Transition>
            <textarea
              v-if="Boolean(file)"
              :value="displayedFileText"
              data-testid="textarea-update-file-read-content"
              :disabled="true"
              class="form-control is-fill py-3"
              rows="10"
            ></textarea>
            <textarea
              v-else
              v-model="manualContent"
              data-testid="textarea-update-file-content"
              :disabled="Boolean(file) || removeContent"
              class="form-control is-fill py-3"
              rows="10"
            ></textarea>
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
      :observers="observers"
      :approvers="approvers"
      :on-executed="handleExecuted"
      :on-local-stored="handleLocalStored"
      :on-submitted="handleSubmit"
    />
    <AddToGroupModal @addToGroup="handleAddToGroup" />
  </div>
</template>
