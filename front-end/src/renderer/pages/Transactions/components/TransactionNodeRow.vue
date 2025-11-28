<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SignSingleButton from '@renderer/pages/Transactions/components/SignSingleButton.vue';
import SignGroupButton from '@renderer/pages/Transactions/components/SignGroupButton.vue';
import { redirectToDetails, redirectToGroupDetails } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../../middle-end/src/ITransactionNode.ts';

/* Props */
const props = defineProps<{
  collection: TransactionNodeCollection;
  node: ITransactionNode;
  index: number;
}>();

/* Composables */
const router = useRouter();

/* Computed */
const hasNotifications = computed(() => {
  // To be implemented
  return false;
});

const transactionType = computed(() => {
  let result: string;
  if (props.node.transactionType) {
    result = getTransactionTypeFromBackendType(props.node.transactionType, false, true);
  } else {
    result = 'Group';
  }
  return result;
});

const validStartDate = computed(() => {
  return new Date(props.node.validStart);
});

/* Handlers */
const handleDetails = async () => {
  if (props.node.transactionId) {
    redirectToDetails(router, props.node.transactionId, true);
  } else if (props.node.groupId) {
    await redirectToGroupDetails(router, props.node.groupId, 'readyToSign');
  }
};
</script>

<template>
  <tr :class="{ highlight: hasNotifications }">
    <!-- Column #1 -->
    <td :data-testid="`td-transaction-id-for-sign-${index}`">
      <TransactionId
        v-if="props.node.sdkTransactionId"
        :transaction-id="props.node.sdkTransactionId"
        wrap
      />
      <i v-else class="bi bi-stack" />
    </td>

    <!-- Column #2 -->
    <td class="text-bold">{{ transactionType }}</td>

    <!-- Column #3 -->
    <td>
      <span class="text-wrap-two-line-ellipsis">{{ props.node.description }}</span>
    </td>

    <!-- Column #4 -->
    <td>
      <DateTimeString :date="validStartDate" compact wrap />
    </td>

    <!-- Column #5 -->
    <td class="text-center">
      <div class="d-flex justify-content-center gap-4">
        <template v-if="props.collection === TransactionNodeCollection.READY_TO_SIGN">
          <SignSingleButton
            v-if="props.node.transactionId"
            :transactionId="props.node.transactionId"
          />
          <SignGroupButton
            v-if="props.node.groupId"
            :group-id="props.node.groupId"
          />
        </template>
        <AppButton
          :data-testid="`button-group-details-${index}`"
          color="secondary"
          type="button"
          @click="handleDetails"
        >
          Details
        </AppButton>
      </div>
    </td>
  </tr>
</template>
