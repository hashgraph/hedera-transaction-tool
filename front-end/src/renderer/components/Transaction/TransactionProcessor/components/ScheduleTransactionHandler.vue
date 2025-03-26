<script setup lang="ts">
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import {
  AccountId,
  Key,
  KeyList,
  ScheduleCreateTransaction,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useAccountId from '@renderer/composables/useAccountId';

import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';

import { isAccountId } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Props */
defineProps<{
  loading: boolean;
}>();

/* Stores */
const network = useNetworkStore();

/* Composables */
const { getPassword, passwordModalOpened } = usePersonalPassword();
const payerData = useAccountId();

/* State */
const request = ref<Processable | null>(null);
const nextHandler = ref<Handler | null>(null);
const show = ref(false);
const validStart = ref<Date>(new Date());
const waitForExpiry = ref(false);
const memo = ref('');
const adminKey = ref<Key | null>(null);

/* Computed */
const transaction = computed(() =>
  request.value instanceof TransactionRequest
    ? Transaction.fromBytes(request.value.transactionBytes)
    : null,
);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

function handle(req: Processable) {
  // TO DO: Set the default fee payer to be the last used IN THE SCHEDULE POPUP

  reset();

  request.value = req;
  validStart.value = transaction.value?.transactionId?.validStart?.toDate() ?? new Date();
  show.value = true;
}

function setShow(value: boolean) {
  show.value = value;
}

/* Handlers */
const handleSchedule = async () => {
  const personalPassword = getPassword(handleSchedule, {
    subHeading: 'Enter your application password to sign the transaction',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (!(request.value instanceof TransactionRequest)) {
    return;
  }

  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  const underlyingTransaction = Transaction.fromBytes(request.value.transactionBytes);

  const scheduleTx = new ScheduleCreateTransaction()
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString(payerData.accountId.value),
        Timestamp.fromDate(validStart.value),
      ),
    )
    .setScheduledTransaction(underlyingTransaction);

  const underlyingPayer = underlyingTransaction.transactionId?.accountId;
  if (!underlyingPayer) {
    throw new Error('Invalid Payer ID');
  }

  const underlyingPayerData = await getAccountInfo(
    underlyingPayer.toString(),
    network.mirrorNodeBaseURL,
  );

  adminKey.value && scheduleTx.setAdminKey(adminKey.value);
  memo.value && scheduleTx.setTransactionMemo(memo.value);
  waitForExpiry.value && scheduleTx.setWaitForExpiry(true);

  const key = new KeyList();
  payerData.key.value && key.push(payerData.key.value);
  adminKey.value && key.push(adminKey.value);
  underlyingPayerData?.key && key.push(underlyingPayerData.key);

  if (nextHandler.value && request.value) {
    await nextHandler.value.handle(
      TransactionRequest.fromData({
        ...request.value,
        transactionKey: key,
        transactionBytes: scheduleTx.toBytes(),
        executionType: 'Scheduled',
      }),
    );
  }
};

/* Functions */
function reset() {
  request.value = null;
  show.value = false;
}

/* Expose */
defineExpose({
  handle,
  setNext,
  setShow,
});
</script>
<template>
  <!-- Confirm modal -->
  <AppModal
    v-model:show="show"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
      </div>
      <div class="text-center">
        <i class="bi bi-arrow-left-right large-icon"></i>
      </div>
      <form v-if="transaction" @submit.prevent="handleSchedule">
        <h3 class="text-center text-title text-bold mt-5">Schedule Transaction</h3>
        <div class="container-main-bg text-small p-4 mt-5">
          <div class="overflow-auto pe-3" :style="{ maxHeight: '50vh' }">
            <div class="form-group">
              <label class="form-label">Payer ID</label>
              <AccountIdInput
                :model-value="payerData.accountId.value"
                @update:model-value="payerData.accountId.value = $event"
                :filled="true"
                placeholder="Enter Payer ID"
                data-testid="dropdown-payer"
              />
            </div>

            <div class="form-group mt-3">
              <label class="form-label"
                >Valid Start <span class="text-muted text-italic">- Local time</span></label
              >
              <RunningClockDatePicker
                v-model="validStart"
                :now-button-visible="true"
                data-testid="date-picker-valid-start"
              />
            </div>

            <div class="mt-3">
              <AppCheckBox
                v-model:checked="waitForExpiry"
                name="wait-for-expiry"
                label="Wait for expiry"
                data-testid="checkbox-wait-for-expiry"
              ></AppCheckBox>
            </div>

            <div class="form-group mt-3">
              <label class="form-label">Transaction Memo</label>
              <AppInput
                data-testid="input-schedule-memo"
                v-model="memo"
                :filled="true"
                maxlength="100"
                placeholder="Enter Schedule Memo"
              />
            </div>

            <div class="form-group mt-3">
              <label class="form-label">Admin Key</label>
              <KeyField :is-required="false" v-model:model-key="adminKey" />
            </div>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            type="button"
            color="borderless"
            data-testid="button-cancel-transaction"
            @click="show = false"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-transaction"
            :loading="loading"
            :disabled="loading"
            >Confirm</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
