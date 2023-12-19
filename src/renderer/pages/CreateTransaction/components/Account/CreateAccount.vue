<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { AccountId, AccountCreateTransaction, KeyList, PublicKey, Hbar } from '@hashgraph/sdk';

import { openExternal } from '../../../../services/electronUtilsService';
import {
  createTransactionId,
  getTransactionSignatures,
} from '../../../../services/transactionService';
import { getAccountInfo } from '../../../../services/mirrorNodeDataService';
import { flattenKeyList } from '../../../../services/keyPairService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useUserStateStore from '../../../../stores/storeUserState';
import useNetworkStore from '../../../../stores/storeNetwork';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAccountCreateModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const payerKeys = ref<string[]>([]);
const validStart = ref('');
const maxTransactionfee = ref(2);

const accountData = reactive({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  initialBalance: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  declineStakingReward: false,
  memo: '',
});

const transaction = ref<AccountCreateTransaction | null>(null);
const isLoading = ref(false);

const ownerKeyText = ref('');
const ownerKeys = ref<string[]>([]);
const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

const handleOwnerKeyTextKeyPress = (e: KeyboardEvent) => {
  if (e.code === 'Enter') handleAdd();
};

const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  ownerKeyText.value = '';
};

const handleGetUserSignature = async () => {
  try {
    isLoading.value = true;

    if (!userStateStore.userData?.userId) {
      throw Error('No user selected');
    }

    if (!transaction.value) {
      return console.log('Transaction or payer missing');
    }

    await getTransactionSignatures(
      keyPairsStore.keyPairs.filter(kp => payerKeys.value.includes(kp.publicKey)),
      transaction.value as any,
      true,
      userStateStore.userData.userId,
      userPassword.value,
    );

    const submitTx = await transaction.value?.execute(networkStore.client);
    const receipt = await submitTx.getReceipt(networkStore.client);

    isSignModalShown.value = false;

    transactionId.value = submitTx.transactionId.toString();
    accountData.accountId = receipt.accountId?.toString() || '';

    isAccountCreateModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  try {
    isLoading.value = true;

    transaction.value = new AccountCreateTransaction()
      .setTransactionId(createTransactionId(payerId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setKey(keyList.value)
      .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
      .setDeclineStakingReward(accountData.declineStakingReward)
      .setInitialBalance(accountData.initialBalance)
      .setMaxAutomaticTokenAssociations(accountData.maxAutomaticTokenAssociations)
      .setAccountMemo(accountData.memo);

    accountData.stakedAccountId &&
      transaction.value.setStakedAccountId(AccountId.fromString(accountData.stakedAccountId));

    Number(accountData.stakedNodeId) > 0 &&
      transaction.value.setStakedNodeId(accountData.stakedNodeId);

    transaction.value.freezeWith(networkStore.client);

    const payerInfo = await getAccountInfo(payerId.value, networkStore.mirrorNodeBaseURL);
    payerKeys.value = flattenKeyList(payerInfo.key).map(pk => pk.toStringRaw());

    if (keyPairsStore.keyPairs.some(kp => payerKeys.value.includes(kp.publicKey))) {
      isSignModalShown.value = true;
    } else {
      // Send to Back End
      console.log('Account create sent to Back End for payer signature');
    }
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
  }
};

watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountCreateModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    accountData.initialBalance = 0;
    accountData.receiverSignatureRequired = false;
    accountData.maxAutomaticTokenAssociations = 0;
    accountData.stakedAccountId = '';
    accountData.stakedNodeId = '';
    accountData.declineStakingReward = false;
    accountData.memo = '';
    accountData.accountId = '';

    transactionId.value = '';
    transaction.value = null;
    ownerKeyText.value = '';
    ownerKeys.value = [];
  }
});
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Create Account Transaction</span>
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

      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Key/s (Required)</label>
        <div class="d-flex gap-3">
          <input
            v-model="ownerKeyText"
            type="text"
            class="form-control"
            placeholder="Enter owner public key"
            style="max-width: 555px"
            @keypress="handleOwnerKeyTextKeyPress"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAdd">Add</AppButton>
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in ownerKeys" :key="key">
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
              @click="ownerKeys = ownerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Initial Balance in HBar (Optional)</label>
        <input
          v-model="accountData.initialBalance"
          type="number"
          min="0"
          class="form-control"
          placeholder="Enter HBar amount"
        />
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
          :disabled="Number(accountData.stakedNodeId) > 0"
          type="text"
          class="form-control"
          placeholder="Enter Account Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Node Id (Optional)</label>
        <input
          v-model="accountData.stakedNodeId"
          :disabled="accountData.stakedAccountId.length > 0"
          type="number"
          min="0"
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
          :disabled="keyList._keys.length === 0 || !payerId"
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
          :disabled="userPassword.length === 0 || isLoading"
          class="mt-5 w-100 rounded-4"
          @click="handleGetUserSignature"
          >Sign</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isAccountCreateModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isAccountCreateModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Account created successfully</h3>
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
          @click="isAccountCreateModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
