<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';

import {
  AccountId,
  Client,
  AccountUpdateTransaction,
  KeyList,
  PrivateKey,
  PublicKey,
  Timestamp,
  TransactionId,
  Hbar,
} from '@hashgraph/sdk';

import { decryptPrivateKey } from '../../../../services/keyPairService';
import { openExternal } from '../../../../services/electronUtilsService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useUserStateStore from '../../../../stores/storeUserState';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAccountUpdatedModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const validStart = ref('');
const maxTransactionfee = ref(2);

const accountData = reactive({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  declineStakingReward: false,
  memo: '',
});

const transaction = ref<AccountUpdateTransaction | null>(null);
const isLoading = ref(false);

const newOwnerKeyText = ref('');
const newOwnerKeys = ref<string[]>([]);
const newOwnerKeyList = computed(
  () => new KeyList(newOwnerKeys.value.map(key => PublicKey.fromString(key))),
);

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

    const signatures: { publicKey: PublicKey; signature: Uint8Array }[] = [];

    await Promise.all(
      keyPairsStore.keyPairs
        .filter(kp => newOwnerKeys.value.includes(kp.publicKey) || payerId.value === kp.accountId)
        .map(async keyPair => {
          const privateKeyString = await decryptPrivateKey(
            userStateStore.userData!.userId,
            userPassword.value,
            keyPair.publicKey,
          );

          if (transaction.value) {
            const privateKey = PrivateKey.fromStringED25519(privateKeyString);
            const signature = privateKey.signTransaction(transaction.value as any);
            signatures.push({ publicKey: PublicKey.fromString(keyPair.publicKey), signature });
          }
        }),
    );

    signatures.forEach(s =>
      transaction.value
        ? (transaction.value = transaction.value.addSignature(s.publicKey, s.signature))
        : '',
    );

    const client = Client.forTestnet();

    const submitTx = await transaction.value?.execute(client);

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
    const transactionId = TransactionId.withValidStart(
      AccountId.fromString(payerId.value),
      Timestamp.fromDate(validStart.value.length > 0 ? validStart.value : new Date()),
    );

    let accountUpdateTransaction = new AccountUpdateTransaction()
      .setTransactionId(transactionId)
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId)
      .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
      .setDeclineStakingReward(accountData.declineStakingReward);

    if (newOwnerKeys.value.length > 0) {
      accountUpdateTransaction.setKey(newOwnerKeyList.value);
    }
    if (accountData.maxAutomaticTokenAssociations > 0)
      accountUpdateTransaction.setMaxAutomaticTokenAssociations(
        accountData.maxAutomaticTokenAssociations,
      );
    if (accountData.stakedAccountId.length > 0 && accountData.stakedNodeId.length === 0) {
      accountUpdateTransaction.setStakedAccountId(accountData.stakedAccountId);
    }
    if (accountData.stakedNodeId.length > 0 && accountData.stakedAccountId.length === 0) {
      accountUpdateTransaction.setStakedNodeId(accountData.stakedNodeId);
    }
    if (accountData.memo.length > 0) {
      accountUpdateTransaction.setAccountMemo(accountData.memo);
    }

    transaction.value = accountUpdateTransaction.freezeWith(Client.forTestnet());

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(
      kp => payerId.value === kp.accountId || newOwnerKeys.value.includes(kp.publicKey),
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

watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAccountUpdatedModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;
    newOwnerKeyText.value = '';

    accountData.receiverSignatureRequired = false;
    accountData.maxAutomaticTokenAssociations = 0;
    accountData.stakedAccountId = '';
    accountData.stakedNodeId = '';
    accountData.declineStakingReward = false;
    accountData.memo = '';
    accountData.accountId = '';

    transactionId.value = '';
    transaction.value = null;
    newOwnerKeys.value = [];
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
          :disabled="accountData.stakedNodeId.length > 0"
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
          @click="isAccountUpdatedModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
