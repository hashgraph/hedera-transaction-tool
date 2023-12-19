<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

import {
  AccountId,
  Client,
  KeyList,
  PublicKey,
  Hbar,
  Key,
  TransferTransaction,
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
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const mirrorLinksStore = useMirrorNodeLinksStore();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isTransferSuccessfulModalShown = ref(false);
const transactionId = ref('');

const payerId = ref('');
const payerKeys = ref<string[]>([]);
const validStart = ref('');
const maxTransactionfee = ref(2);

const isApprovedTransfer = ref(false);

const spenderAllowances = ref<MirrorNodeAllowance[]>([]);

const senderData = reactive<{
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

const receiverData = reactive<{
  accountId: string;
  key: Key | null;
  balance: Hbar;
  receiveSignatureRequired: boolean;
  valid: boolean;
}>({
  accountId: '',
  balance: new Hbar(0),
  key: null,
  receiveSignatureRequired: false,
  valid: false,
});

const amount = ref(0);

const keyStructureComponentKey = ref(senderData.key);

const transaction = ref<TransferTransaction | null>(null);
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

    if (!isApprovedTransfer.value && senderData.key) {
      let senderKeys = flattenKeyList(senderData.key).map(pk => pk.toStringRaw());
      keys = keys.concat(keyPairsStore.keyPairs.filter(kp => senderKeys.includes(kp.publicKey)));
    }

    if (receiverData.receiveSignatureRequired && receiverData.key) {
      let receiverKeys = flattenKeyList(receiverData.key).map(pk => pk.toStringRaw());
      keys = keys.concat(keyPairsStore.keyPairs.filter(kp => receiverKeys.includes(kp.publicKey)));
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

    isTransferSuccessfulModalShown.value = true;

    // Send to Transaction w/ user signatures to Back End
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  try {
    isLoading.value = true;

    transaction.value = new TransferTransaction()
      .setTransactionId(createTransactionId(payerId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .addHbarTransfer(receiverData.accountId, new Hbar(amount.value));

    if (isApprovedTransfer.value) {
      transaction.value.addApprovedHbarTransfer(
        senderData.accountId,
        new Hbar(amount.value).negated(),
      );
    } else {
      transaction.value.addHbarTransfer(senderData.accountId, new Hbar(amount.value).negated());
    }

    transaction.value.freezeWith(Client.forTestnet());

    const payerInfo = await getAccountInfo(payerId.value, mirrorLinksStore.mainnet);
    payerKeys.value = flattenKeyList(payerInfo.key).map(pk => pk.toStringRaw());

    let someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      payerKeys.value.includes(kp.publicKey),
    );

    if (!isApprovedTransfer.value) {
      let keys = senderData.key ? flattenKeyList(senderData.key).map(pk => pk.toStringRaw()) : [];
      someUserAccountIsPayer =
        someUserAccountIsPayer || keyPairsStore.keyPairs.some(kp => keys.includes(kp.publicKey));
    }

    if (receiverData.receiveSignatureRequired) {
      let keys = receiverData.key
        ? flattenKeyList(receiverData.key).map(pk => pk.toStringRaw())
        : [];
      someUserAccountIsPayer =
        someUserAccountIsPayer || keyPairsStore.keyPairs.some(kp => keys.includes(kp.publicKey));
    }

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

const handleResetSenderData = () => {
  senderData.balance = new Hbar(0);
  senderData.key = null;
  senderData.valid = false;
};

const handleResetReceiverData = () => {
  receiverData.balance = new Hbar(0);
  receiverData.key = null;
  receiverData.receiveSignatureRequired = false;
  receiverData.valid = false;
};

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isTransferSuccessfulModalShown, shown => {
  if (!shown) {
    payerId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    senderData.accountId = '';
    receiverData.accountId = '';
    handleResetSenderData();
    handleResetReceiverData();

    transactionId.value = '';
    transaction.value = null;
  }
});
watch(
  () => senderData.accountId,
  async newAccountId => {
    if (!newAccountId) return handleResetSenderData();

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      senderData.accountId = accountInfo.accountId.toString();
      senderData.balance = accountInfo.balance;
      senderData.key = accountInfo.key;
      senderData.valid = true;

      const allowances = await getAccountAllowances(newAccountId, mirrorLinksStore.mainnet);

      spenderAllowances.value = allowances;
    } catch (e) {
      handleResetSenderData();
    }
  },
);
watch(
  () => receiverData.accountId,
  async newAccountId => {
    if (!newAccountId) return handleResetReceiverData();

    try {
      AccountId.fromString(newAccountId);

      const accountInfo = await getAccountInfo(newAccountId, mirrorLinksStore.mainnet);
      receiverData.accountId = accountInfo.accountId.toString();
      receiverData.balance = accountInfo.balance;
      receiverData.key = accountInfo.key;
      receiverData.receiveSignatureRequired = accountInfo.receiverSignatureRequired;
      receiverData.valid = true;
    } catch (e) {
      handleResetReceiverData();
    }
  },
);
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Transfer Hbar Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label"
            >Set {{ isApprovedTransfer ? 'Spender' : 'Payer' }} ID (Required)</label
          >
          <label
            v-if="isApprovedTransfer && spenderAllowances.some(al => al.spender === payerId)"
            class="d-block form-label text-secondary"
            >Allowance:
            {{
              Hbar.fromTinybars(spenderAllowances.find(sp => sp.spender === payerId)?.amount)
            }}</label
          >
          <input
            v-model="payerId"
            type="text"
            class="form-control"
            :placeholder="`Enter ${isApprovedTransfer ? 'Spender' : 'Payer'} ID`"
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
        <label class="form-label">Set Sender ID</label>
        <label
          v-if="senderData.valid"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ senderData.balance }}</label
        >
        <input
          v-model="senderData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Sender ID"
        />
      </div>
      <div class="mt-4" v-if="senderData.key">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = senderData.key;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Receiver ID</label>
        <label
          v-if="receiverData.valid"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ receiverData.balance }}</label
        >
        <input
          v-model="receiverData.accountId"
          type="text"
          class="form-control"
          placeholder="Enter Receiver ID"
        />
      </div>
      <div class="mt-4" v-if="receiverData.receiveSignatureRequired && receiverData.key">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = receiverData.key;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Amount</label>
        <input v-model="amount" type="number" class="form-control" placeholder="Enter Amount" />
      </div>
      <div class="mt-4">
        <AppSwitch
          v-model:checked="isApprovedTransfer"
          name="is-approved-transfer"
          size="md"
          label="Approved Transfer (Transaction payer is the allowance spender)"
        />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="!payerId || !senderData.accountId || !receiverData.accountId || amount < 0"
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
    <AppModal v-model:show="isTransferSuccessfulModalShown" class="transaction-success-modal">
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isTransferSuccessfulModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Successful transfer</h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="openExternal(`https://hashscan.io/testnet/transaction/${transactionId}`)"
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Sender Account ID:</span>
          <span>{{ senderData.accountId }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Receiver Account ID:</span>
          <span>{{ receiverData.accountId }}</span>
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isTransferSuccessfulModalShown = false"
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
