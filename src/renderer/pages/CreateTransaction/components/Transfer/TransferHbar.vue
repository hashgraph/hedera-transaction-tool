<script setup lang="ts">
import { ref, watch } from 'vue';

import { AccountId, KeyList, PublicKey, Hbar, Key, TransferTransaction } from '@hashgraph/sdk';

import { openExternal } from '../../../../services/electronUtilsService';
import {
  createTransactionId,
  getTransactionSignatures,
  execute,
} from '../../../../services/transactionService';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useNetworkStore from '../../../../stores/storeNetwork';
import useUserStateStore from '../../../../stores/storeUserState';

import useAccountId from '../../../../composables/useAccountId';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();

const payerData = useAccountId();
const senderData = useAccountId();
const receiverData = useAccountId();

/* State */
const isKeyStructureModalShown = ref(false);

const isSignModalShown = ref(false);
const userPassword = ref('');

const isTransferSuccessfulModalShown = ref(false);
const transactionId = ref('');

const validStart = ref('');
const maxTransactionfee = ref(2);

const isApprovedTransfer = ref(false);

const amount = ref(0);

const keyStructureComponentKey = ref<Key | null>(null);

const transaction = ref<TransferTransaction | null>(null);
const isLoading = ref(false);

const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value || !payerData.accountInfo.value?.accountId) {
    return console.log('Transaction or payer missing');
  }

  try {
    isLoading.value = true;

    let keys = keyPairsStore.keyPairs.filter(kp =>
      payerData.keysFlattened.value.includes(kp.publicKey),
    );

    if (!isApprovedTransfer.value && senderData.key.value) {
      keys = keys.concat(
        keyPairsStore.keyPairs.filter(kp => senderData.keysFlattened.value.includes(kp.publicKey)),
      );
    }

    if (receiverData.accountInfo.value?.receiverSignatureRequired && receiverData.key.value) {
      keys = keys.concat(
        keyPairsStore.keyPairs.filter(kp =>
          receiverData.keysFlattened.value.includes(kp.publicKey),
        ),
      );
    }

    await getTransactionSignatures(
      keys,
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
    isTransferSuccessfulModalShown.value = true;
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
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .addHbarTransfer(receiverData.accountId.value, new Hbar(amount.value));

    if (isApprovedTransfer.value) {
      transaction.value.addApprovedHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
    } else {
      transaction.value.addHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
    }

    transaction.value.freezeWith(networkStore.client);

    let someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      payerData.keysFlattened.value.includes(kp.publicKey),
    );

    if (!isApprovedTransfer.value) {
      someUserAccountIsPayer =
        someUserAccountIsPayer ||
        keyPairsStore.keyPairs.some(kp => senderData.keysFlattened.value.includes(kp.publicKey));
    }

    if (receiverData.accountInfo.value?.receiverSignatureRequired) {
      someUserAccountIsPayer =
        someUserAccountIsPayer ||
        keyPairsStore.keyPairs.some(kp => receiverData.keysFlattened.value.includes(kp.publicKey));
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

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isTransferSuccessfulModalShown, shown => {
  if (!shown) {
    payerData.accountId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    senderData.accountId.value = '';
    receiverData.accountId.value = '';

    transactionId.value = '';
    transaction.value = null;
  }
});
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
            v-if="isApprovedTransfer && payerData.isValid.value"
            class="d-block form-label text-secondary"
            >Allowance: {{ senderData.getSpenderAllowance(payerData.accountId.value) }}</label
          >
          <label
            v-if="!isApprovedTransfer && payerData.isValid.value"
            class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
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
          v-if="senderData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ senderData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="senderData.accountIdFormatted.value"
          @input="senderData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Sender ID"
        />
      </div>
      <div class="mt-4" v-if="senderData.key.value">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = senderData.key.value;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Receiver ID</label>
        <label
          v-if="receiverData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ receiverData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="receiverData.accountIdFormatted.value"
          @input="receiverData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Receiver ID"
        />
      </div>
      <div
        class="mt-4"
        v-if="receiverData.accountInfo.value?.receiverSignatureRequired && receiverData.key.value"
      >
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = receiverData.key.value;
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
          :disabled="
            !payerData.accountId.value ||
            !senderData.accountId.value ||
            !receiverData.accountId.value ||
            amount < 0
          "
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
            @click="
              networkStore.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${networkStore.network}/transaction/${transactionId}`)
            "
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Sender Account ID:</span>
          <span>{{ senderData.accountId.value }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Receiver Account ID:</span>
          <span>{{ receiverData.accountId.value }}</span>
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
