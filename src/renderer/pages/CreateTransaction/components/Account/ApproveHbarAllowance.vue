<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

import {
  AccountId,
  Client,
  KeyList,
  PublicKey,
  Hbar,
  Key,
  AccountAllowanceApproveTransaction,
} from '@hashgraph/sdk';

import { flattenKeyList } from '../../../../services/keyPairService';
import { openExternal } from '../../../../services/electronUtilsService';
import { getAccountAllowances, getAccountInfo } from '../../../../services/mirrorNodeDataService';
import {
  createTransactionId,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useMirrorNodeLinksStore from '../../../../stores/storeMirrorNodeLinks';
import useUserStateStore from '../../../../stores/storeUserState';

import { MirrorNodeAllowance } from '../../../../interfaces/MirrorNodeAllowance';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const mirrorLinksStore = useMirrorNodeLinksStore();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isAllowanceApprovedModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const payerKeys = ref<string[]>([]);
const validStart = ref('');
const maxTransactionfee = ref(2);

const ownerAllowances = ref<MirrorNodeAllowance[]>([]);

const ownerData = reactive<{
  accountId: string;
  key: Key | null;
  balance: Hbar;
  valid: boolean;
}>({
  accountId: '',
  balance: new Hbar(0),
  key: null,
  valid: false,
});

const spenderData = reactive<{
  accountId: string;
  key: Key | null;
  balance: Hbar;
  valid: boolean;
}>({
  accountId: '',
  balance: new Hbar(0),
  key: null,
  valid: false,
});

const amount = ref(0);

const keyStructureComponentKey = ref(ownerData.key);

const transaction = ref<AccountAllowanceApproveTransaction | null>(null);
const isLoading = ref(false);

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value || !payerId.value) {
    return console.log('Transaction or payer missing');
  }

  try {
    isLoading.value = true;

    let keys = keyPairsStore.keyPairs.filter(kp => payerKeys.value.includes(kp.publicKey));

    if (ownerData.key) {
      let ownerKeys = flattenKeyList(ownerData.key).map(pk => pk.toStringRaw());
      keys = keys.concat(keyPairsStore.keyPairs.filter(kp => ownerKeys.includes(kp.publicKey)));
    }

    await getTransactionSignatures(
      keys,
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

    isAllowanceApprovedModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  try {
    if (!ownerData.accountId || !ownerData.valid) {
      throw Error('Invalid owner');
    }

    isLoading.value = true;

    transaction.value = new AccountAllowanceApproveTransaction()
      .setTransactionId(createTransactionId(payerId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .approveHbarAllowance(ownerData.accountId, spenderData.accountId, new Hbar(amount.value))
      .freezeWith(Client.forTestnet());

    const payerInfo = await getAccountInfo(payerId.value, mirrorLinksStore.mainnet);
    payerKeys.value = flattenKeyList(payerInfo.key).map(pk => pk.toStringRaw());

    let ownerKeys = ownerData.key ? flattenKeyList(ownerData.key).map(pk => pk.toStringRaw()) : [];

    let someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      payerKeys.value.concat(ownerKeys).includes(kp.publicKey),
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

const handleResetOwnerData = () => {
  ownerData.balance = new Hbar(0);
  ownerData.key = null;
  ownerData.valid = false;
};

const handleResetSpenderData = () => {
  spenderData.balance = new Hbar(0);
  spenderData.key = null;
  spenderData.valid = false;
};

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAllowanceApprovedModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    ownerData.accountId = '';
    spenderData.accountId = '';
    handleResetOwnerData();
    handleResetSpenderData();

    transactionId.value = '';
    transaction.value = null;
  }
});
watch(
  () => ownerData.accountId,
  async newAccountId => {
    if (!newAccountId) return handleResetOwnerData();

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      ownerData.accountId = accountInfo.accountId.toString();
      ownerData.balance = accountInfo.balance;
      ownerData.key = accountInfo.key;
      ownerData.valid = true;

      const allowances = await getAccountAllowances(newAccountId, mirrorLinksStore.mainnet);

      ownerAllowances.value = allowances;
    } catch (e) {
      handleResetOwnerData();
    }
  },
);
watch(
  () => spenderData.accountId,
  async newAccountId => {
    if (!newAccountId) return handleResetSpenderData();

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      spenderData.accountId = accountInfo.accountId.toString();
      spenderData.balance = accountInfo.balance;
      spenderData.key = accountInfo.key;
      spenderData.valid = true;
    } catch (e) {
      handleResetSpenderData();
    }
  },
);
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Approve Hbar Allowance Transaction</span>
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
        <label class="form-label">Set Owner ID</label>
        <label
          v-if="ownerData.valid"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ ownerData.balance }}</label
        >
        <input
          v-model="ownerData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Owner ID"
        />
      </div>
      <div class="mt-4" v-if="ownerData.key">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = ownerData.key;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Spender ID</label>
        <label
          v-if="spenderData.valid"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Allowance:
          {{ Hbar.fromTinybars(ownerAllowances.find(a => a.spender)?.amount || 0) }}</label
        >
        <input
          v-model="spenderData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Spender ID"
        />
      </div>
      <div class="mt-4" v-if="spenderData.key">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = spenderData.key;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Amount</label>
        <input v-model="amount" type="number" class="form-control" placeholder="Enter Amount" />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="!payerId || !ownerData.valid || !spenderData.valid || amount < 0"
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
    <AppModal v-model:show="isAllowanceApprovedModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isAllowanceApprovedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Allowance Approved Successfully</h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="openExternal(`https://hashscan.io/testnet/transaction/${transactionId}`)"
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Owner Account ID:</span>
          <span>{{ ownerData.accountId }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Spender Account ID:</span>
          <span>{{ spenderData.accountId }}</span>
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isAllowanceApprovedModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
    <AppModal v-model:show="isKeyStructureModalShown" class="modal-fit-content">
      <div class="p-5">
        <KeyStructure
          v-if="keyStructureComponentKey instanceof KeyList && true"
          :key-list="keyStructureComponentKey"
        />
        <div v-else-if="keyStructureComponentKey instanceof PublicKey && true">
          {{ keyStructureComponentKey.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
