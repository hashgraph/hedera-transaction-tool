<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  AccountId,
  KeyList,
  PublicKey,
  Hbar,
  Key,
  AccountAllowanceApproveTransaction,
} from '@hashgraph/sdk';

import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useNetworkStore from '../../../../stores/storeNetwork';
import useUserStateStore from '../../../../stores/storeUserState';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { openExternal } from '../../../../services/electronUtilsService';
import {
  createTransactionId,
  execute,
  getTransactionSignatures,
} from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transaction = ref<AccountAllowanceApproveTransaction | null>(null);
const transactionId = ref('');
const validStart = ref('');
const maxTransactionfee = ref(2);

const userPassword = ref('');
const amount = ref(0);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);
const isSignModalShown = ref(false);
const isAllowanceApprovedModalShown = ref(false);
const isLoading = ref(false);

/* Handlers */
const handleGetUserSignature = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  if (!transaction.value || !payerData.isValid.value) {
    return console.log('Transaction or payer missing');
  }

  try {
    isLoading.value = true;

    let keys = keyPairsStore.keyPairs.filter(kp =>
      payerData.keysFlattened.value.includes(kp.publicKey),
    );

    keys = keys.concat(
      keyPairsStore.keyPairs.filter(kp => ownerData.keysFlattened.value.includes(kp.publicKey)),
    );

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
    isAllowanceApprovedModalShown.value = true;
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
  try {
    if (!ownerData.accountId.value || !ownerData.isValid.value) {
      throw Error('Invalid owner');
    }

    isLoading.value = true;

    transaction.value = new AccountAllowanceApproveTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .approveHbarAllowance(
        ownerData.accountId.value,
        spenderData.accountId.value,
        new Hbar(amount.value),
      )
      .freezeWith(networkStore.client);

    const someUserAccountIsPayer = keyPairsStore.keyPairs.some(kp =>
      payerData.keysFlattened.value.concat(ownerData.keysFlattened.value).includes(kp.publicKey),
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

/* Watchers */
watch(isSignModalShown, () => (userPassword.value = ''));
watch(isAllowanceApprovedModalShown, shown => {
  if (!shown) {
    payerData.accountId.value = '';
    validStart.value = '';
    maxTransactionfee.value = 2;

    ownerData.accountId.value = '';
    spenderData.accountId.value = '';

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
        <span class="text-title text-bold">Approve Hbar Allowance Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance }}</label
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
        <label class="form-label">Set Owner ID</label>
        <label
          v-if="ownerData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ ownerData.accountInfo.value?.balance }}</label
        >
        <input
          :value="ownerData.accountIdFormatted.value"
          @input="ownerData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Owner ID"
        />
      </div>
      <div class="mt-4" v-if="ownerData.key.value">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = ownerData.key.value;
          "
          >View Key Structure</AppButton
        >
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Spender ID</label>
        <label
          v-if="spenderData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Allowance: {{ ownerData.getSpenderAllowance(spenderData.accountId.value) }}</label
        >
        <input
          :value="spenderData.accountIdFormatted.value"
          @input="spenderData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          placeholder="Enter Spender ID"
        />
      </div>
      <div class="mt-4" v-if="spenderData.key.value">
        <AppButton
          color="secondary"
          size="small"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = spenderData.key.value;
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
          :disabled="
            !payerData.isValid.value ||
            !ownerData.isValid.value ||
            !spenderData.isValid.value ||
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
            @click="
              networkStore.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${networkStore.network}/transaction/${transactionId}`)
            "
            >{{ transactionId }}</a
          >
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Owner Account ID:</span>
          <span>{{ ownerData.accountId.value }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Spender Account ID:</span>
          <span>{{ spenderData.accountId.value }}</span>
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
