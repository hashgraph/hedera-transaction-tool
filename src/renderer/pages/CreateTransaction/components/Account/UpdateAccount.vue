<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';

import {
  AccountId,
  Client,
  AccountUpdateTransaction,
  KeyList,
  PublicKey,
  Hbar,
  Key,
} from '@hashgraph/sdk';

import { flattenKeyList } from '../../../../services/keyPairService';
import { openExternal } from '../../../../services/electronUtilsService';
import { getAccountInfo } from '../../../../services/mirrorNodeDataService';
import {
  createTransactionId,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useMirrorNodeLinksStore from '../../../../stores/storeMirrorNodeLinks';
import useUserStateStore from '../../../../stores/storeUserState';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const mirrorLinksStore = useMirrorNodeLinksStore();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAccountUpdatedModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const validStart = ref('');
const maxTransactionfee = ref(2);

const accountData = reactive<{
  accountId: string;
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: number;
  stakedAccountId: string | null;
  stakedNodeId: number | null;
  declineStakingReward: boolean;
  memo: string;
  key: Key | null;
}>({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: null,
  declineStakingReward: false,
  memo: '',
  key: null,
});

const initialAccountData = reactive<{
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: number;
  stakedAccountId: string | null;
  stakedNodeId: number | null;
  declineStakingReward: boolean;
  memo: string;
}>({
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: null,
  declineStakingReward: false,
  memo: '',
});

const transaction = ref<AccountUpdateTransaction | null>(null);
const isLoading = ref(false);

const newOwnerKeyText = ref('');
const newOwnerKeys = ref<string[]>([]);

/* Computed */
const newOwnerKeyList = computed(
  () => new KeyList(newOwnerKeys.value.map(key => PublicKey.fromString(key))),
);

/* Handlers */
const handleNewOwnerKeyTextKeyPress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') handleAdd();
};

const handleAdd = () => {
  newOwnerKeys.value.push(newOwnerKeyText.value);
  newOwnerKeys.value = newOwnerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  newOwnerKeyText.value = '';
};

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value) {
    return console.log('Transaction or payer missing');
  }

  try {
    isLoading.value = true;

    let accountKeys = accountData.key
      ? flattenKeyList(accountData.key).map(pk => pk.toStringRaw())
      : [];

    await getTransactionSignatures(
      keyPairsStore.keyPairs.filter(
        kp =>
          newOwnerKeys.value.includes(kp.publicKey) ||
          payerId.value === kp.accountId ||
          accountKeys.includes(kp.publicKey),
      ),
      transaction.value as any,
      true,
      userStateStore.userData.userId,
      userPassword.value,
    );

    const client = Client.forTestnet();
    const submitTx = await transaction.value?.execute(client);
    await submitTx.getReceipt(client);

    isSignModalShown.value = false;

    transactionId.value = submitTx.transactionId.toString();

    isAccountUpdatedModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  isLoading.value = true;

  try {
    transaction.value = new AccountUpdateTransaction()
      .setTransactionId(createTransactionId(payerId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId)
      .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
      .setDeclineStakingReward(accountData.declineStakingReward)
      .setMaxAutomaticTokenAssociations(accountData.maxAutomaticTokenAssociations)
      .setAccountMemo(accountData.memo);

    newOwnerKeys.value.length > 0 && transaction.value.setKey(newOwnerKeyList.value);

    if (
      accountData.stakedAccountId &&
      accountData.stakedAccountId.length > 0 &&
      !accountData.stakedNodeId &&
      initialAccountData.stakedAccountId !== accountData.stakedAccountId
    ) {
      transaction.value.setStakedAccountId(accountData.stakedAccountId);
    }

    if (
      accountData.stakedAccountId !== initialAccountData.stakedAccountId &&
      accountData.stakedAccountId?.length === 0
    ) {
      transaction.value.clearStakedAccountId();
    }

    if (
      accountData.stakedNodeId &&
      !accountData.stakedAccountId &&
      initialAccountData.stakedNodeId !== accountData.stakedNodeId
    ) {
      transaction.value.setStakedNodeId(accountData.stakedNodeId);
    }

    if (accountData.stakedNodeId !== initialAccountData.stakedNodeId && !accountData.stakedNodeId) {
      transaction.value.clearStakedNodeId();
    }

    transaction.value.freezeWith(Client.forTestnet());

    let accountKeys = accountData.key
      ? flattenKeyList(accountData.key).map(pk => pk.toStringRaw())
      : [];

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(
      kp =>
        payerId.value === kp.accountId ||
        newOwnerKeys.value.includes(kp.publicKey) ||
        accountKeys.includes(kp.publicKey),
    );

    if (someUserAccountIsPayer) {
      isSignModalShown.value = true;
    } else {
      // Send to Back End (Payer, old key, new key should sign!)
      console.log('Account create sent to Back End for payer signature');
    }
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
  }
};

const handleResetAccoundData = () => {
  accountData.receiverSignatureRequired = false;
  accountData.maxAutomaticTokenAssociations = 0;
  accountData.stakedAccountId = '';
  accountData.stakedNodeId = null;
  accountData.declineStakingReward = false;
  accountData.memo = '';
  accountData.key = null;

  initialAccountData.receiverSignatureRequired = false;
  initialAccountData.maxAutomaticTokenAssociations = 0;
  initialAccountData.stakedAccountId = '';
  initialAccountData.stakedNodeId = null;
  initialAccountData.declineStakingReward = false;
  initialAccountData.memo = '';
};

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountUpdatedModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;
    newOwnerKeyText.value = '';

    accountData.accountId = '';
    handleResetAccoundData();

    transactionId.value = '';
    transaction.value = null;
    newOwnerKeys.value = [];
  }
});
watch(
  () => accountData.accountId,
  async newAccountId => {
    if (!newAccountId) return;

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      if (accountInfo) {
        accountData.accountId = accountInfo.accountId.toString();
        accountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
        accountData.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations;
        accountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
        accountData.stakedNodeId = accountInfo.stakedNodeId || null;
        accountData.declineStakingReward = accountInfo.declineReward;
        accountData.memo = accountInfo.memo;
        accountData.key = accountInfo.key;

        initialAccountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
        initialAccountData.maxAutomaticTokenAssociations =
          accountInfo.maxAutomaticTokenAssociations;
        initialAccountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
        initialAccountData.stakedNodeId = accountInfo.stakedNodeId || null;
        initialAccountData.declineStakingReward = accountInfo.declineReward;
        initialAccountData.memo = accountInfo.memo;
      }
    } catch (e) {
      handleResetAccoundData();
    }
  },
);
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Update Account Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <input v-model="payerId" type="text" class="form-control" placeholder="Enter Payer ID" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control" />
        </div>
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Account ID (Required)</label>
        <input
          v-model="accountData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="mt-4" v-if="accountData.key">
        <AppButton color="secondary" size="small" @click="isKeyStructureModalShown = true"
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Key/s (Optional)</label>
        <div class="d-flex gap-3">
          <input
            v-model="newOwnerKeyText"
            type="text"
            class="form-control"
            placeholder="Enter new owner public key"
            style="max-width: 555px"
            @keypress="handleNewOwnerKeyTextKeyPress"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAdd">Add</AppButton>
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in newOwnerKeys" :key="key">
          <div class="d-flex align-items-center gap-3">
            <input
              type="text"
              readonly
              class="form-control"
              :value="key"
              style="max-width: 555px"
            />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              style="line-height: 16px"
              @click="newOwnerKeys = newOwnerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-50">
        <AppSwitch
          v-model:checked="accountData.receiverSignatureRequired"
          size="md"
          name="receiver-signature"
          label="Receiver Signature Required"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Max Automatic Token Associations (Optional)</label>
        <input
          v-model="accountData.maxAutomaticTokenAssociations"
          type="number"
          :min="0"
          :max="5000"
          class="form-control"
          placeholder="Enter timestamp"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Account Id (Optional)</label>
        <input
          v-model="accountData.stakedAccountId"
          :disabled="Boolean(accountData.stakedNodeId)"
          type="text"
          class="form-control"
          placeholder="Enter Account Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Node Id (Optional)</label>
        <input
          v-model="accountData.stakedNodeId"
          :disabled="Boolean(accountData.stakedAccountId && accountData.stakedAccountId.length > 0)"
          type="text"
          class="form-control"
          placeholder="Enter Node Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <AppSwitch
          v-model:checked="accountData.declineStakingReward"
          size="md"
          name="decline-signature"
          label="Decline Staking Reward"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Account Memo (Optional)</label>
        <input
          v-model="accountData.memo"
          type="text"
          maxlength="100"
          class="form-control"
          placeholder="Enter Account Memo"
        />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="!accountData.accountId || !payerId"
          @click="handleCreate"
          >Create</AppButton
        >
      </div>
    </div>
    <AppModal v-model:show="isSignModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSignModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-shield-lock extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>
        <div class="mt-4 form-group">
          <input v-model="userPassword" type="password" class="form-control rounded-4" />
        </div>
        <AppButton
          color="primary"
          size="large"
          :loading="isLoading"
          :disabled="userPassword.length === 0"
          class="mt-5 w-100 rounded-4"
          @click="handleGetUserSignature"
          >Sign</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isAccountUpdatedModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isAccountUpdatedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Account updated successfully</h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="openExternal(`https://hashscan.io/testnet/transaction/${transactionId}`)"
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{ accountData.accountId }}</span>
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isAccountUpdatedModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isKeyStructureModalShown" class="modal-fit-content">
      <div class="p-5">
        <KeyStructure
          v-if="accountData.key instanceof KeyList && true"
          :key-list="accountData.key"
        />
        <div v-else-if="accountData.key instanceof PublicKey && true">
          {{ accountData.key.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
