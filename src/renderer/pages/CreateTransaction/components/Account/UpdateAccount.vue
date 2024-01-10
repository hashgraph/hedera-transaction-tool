<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted } from 'vue';
import { AccountId, AccountUpdateTransaction, KeyList, PublicKey, Hbar } from '@hashgraph/sdk';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useNetworkStore from '../../../../stores/storeNetwork';
import useUserStateStore from '../../../../stores/storeUserState';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '../../../../composables/useAccountId';

import { openExternal } from '../../../../services/electronUtilsService';
import {
  createTransactionId,
  execute,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();
const payerData = useAccountId();
const accountData = useAccountId();

/* Composables */
const route = useRoute();
const toast = useToast();

/* State */
const transaction = ref<AccountUpdateTransaction | null>(null);
const transactionId = ref('');
const validStart = ref('');
const maxTransactionfee = ref(2);

const newAccountData = reactive<{
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

const newOwnerKeyText = ref('');
const newOwnerKeys = ref<string[]>([]);
const userPassword = ref('');

const isKeyStructureModalShown = ref(false);
const isSignModalShown = ref(false);
const isAccountUpdatedModalShown = ref(false);
const isLoading = ref(false);

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
  try {
    isLoading.value = true;

    if (!userStateStore.userData?.userId) {
      throw new Error('No user selected');
    }

    if (!transaction.value) {
      throw new Error('Transaction is missing');
    }

    await getTransactionSignatures(
      keyPairsStore.keyPairs.filter(kp =>
        newOwnerKeys.value
          .concat(accountData.keysFlattened.value, payerData.keysFlattened.value)
          .includes(kp.publicKey),
      ),

      transaction.value as any,
      true,
      userStateStore.userData.userId,
      userPassword.value,
    );

    // Send to Transaction w/ user signatures to Back End
    const { transactionId: txId } = await execute(
      transaction.value.toBytes().toString(),
      networkStore.network,
      networkStore.customNetworkSettings,
    );
    transactionId.value = txId;

    isSignModalShown.value = false;
    isAccountUpdatedModalShown.value = true;
  } catch (err: any) {
    let message = 'Transaction failed';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  isLoading.value = true;

  try {
    if (!accountData.accountInfo.value) {
      throw Error('Invalid Account');
    }

    transaction.value = new AccountUpdateTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId.value)
      .setReceiverSignatureRequired(newAccountData.receiverSignatureRequired)
      .setDeclineStakingReward(newAccountData.declineStakingReward)
      .setMaxAutomaticTokenAssociations(newAccountData.maxAutomaticTokenAssociations)
      .setAccountMemo(newAccountData.memo);

    newOwnerKeys.value.length > 0 && transaction.value.setKey(newOwnerKeyList.value);

    if (
      newAccountData.stakedAccountId &&
      newAccountData.stakedAccountId.length > 0 &&
      !newAccountData.stakedNodeId &&
      accountData.accountInfo.value.stakedAccountId?.toString() !== newAccountData.stakedAccountId
    ) {
      transaction.value.setStakedAccountId(AccountId.fromString(newAccountData.stakedAccountId));
    }

    if (
      newAccountData.stakedAccountId !==
        accountData.accountInfo.value.stakedAccountId?.toString() &&
      newAccountData.stakedAccountId?.length === 0
    ) {
      transaction.value.clearStakedAccountId();
    }

    if (
      newAccountData.stakedNodeId &&
      !newAccountData.stakedAccountId &&
      accountData.accountInfo.value.stakedNodeId?.toString() !==
        newAccountData.stakedNodeId.toString()
    ) {
      transaction.value.setStakedNodeId(newAccountData.stakedNodeId);
    }

    if (
      newAccountData.stakedNodeId?.toString() !==
        accountData.accountInfo.value.stakedNodeId?.toString() &&
      !newAccountData.stakedNodeId
    ) {
      transaction.value.clearStakedNodeId();
    }

    transaction.value.freezeWith(networkStore.client);

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      newOwnerKeys.value
        .concat(accountData.keysFlattened.value, payerData.keysFlattened.value)
        .includes(kp.publicKey),
    );

    if (someUserAccountIsPayer) {
      isSignModalShown.value = true;
    } else {
      // Send to Back End (Payer, old key, new key should sign!)
      console.log('Account create sent to Back End for payer signature');
    }
  } catch (err: any) {
    let message = 'Failed to create transaction';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  } finally {
    isLoading.value = false;
  }
};

/* Hooks */
onMounted(() => {
  if (route.query.accountId) {
    accountData.accountId.value = route.query.accountId.toString();
  }
});

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountUpdatedModalShown, shown => {
  if (!shown) {
    payerData.accountId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;
    newOwnerKeyText.value = '';

    accountData.accountId.value = '';

    transactionId.value = '';
    transaction.value = null;
    newOwnerKeys.value = [];
  }
});
watch(accountData.accountInfo, accountInfo => {
  if (!accountInfo) {
    newAccountData.receiverSignatureRequired = false;
    newAccountData.maxAutomaticTokenAssociations = 0;
    newAccountData.stakedAccountId = '';
    newAccountData.stakedNodeId = null;
    newAccountData.declineStakingReward = false;
    newAccountData.memo = '';
  } else {
    newAccountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
    newAccountData.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations;
    newAccountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
    newAccountData.stakedNodeId = accountInfo.stakedNodeId;
    newAccountData.declineStakingReward = accountInfo.declineReward;
    newAccountData.memo = accountInfo.memo;
  }
});
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
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control"
            placeholder="Enter Payer ID"
          />
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
          :value="accountData.accountIdFormatted.value"
          @input="accountData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="mt-4" v-if="accountData.key.value">
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
          v-model:checked="newAccountData.receiverSignatureRequired"
          size="md"
          name="receiver-signature"
          label="Receiver Signature Required"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Max Automatic Token Associations (Optional)</label>
        <input
          v-model="newAccountData.maxAutomaticTokenAssociations"
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
          v-model="newAccountData.stakedAccountId"
          :disabled="Boolean(newAccountData.stakedNodeId)"
          type="text"
          class="form-control"
          placeholder="Enter Account Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Node Id (Optional)</label>
        <input
          v-model="newAccountData.stakedNodeId"
          :disabled="
            Boolean(newAccountData.stakedAccountId && newAccountData.stakedAccountId.length > 0)
          "
          type="text"
          class="form-control"
          placeholder="Enter Node Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <AppSwitch
          v-model:checked="newAccountData.declineStakingReward"
          size="md"
          name="decline-signature"
          label="Decline Staking Reward"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Account Memo (Optional)</label>
        <input
          v-model="newAccountData.memo"
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
          :disabled="!accountData.accountId.value || !payerData.isValid.value"
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
            @click="
              networkStore.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${networkStore.network}/transaction/${transactionId}`)
            "
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{ accountData.accountId.value }}</span>
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
          v-if="accountData.key.value instanceof KeyList && true"
          :key-list="accountData.key.value"
        />
        <div v-else-if="accountData.key.value instanceof PublicKey && true">
          {{ accountData.key.value.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
