<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import useNotificationsStore from '@renderer/stores/storeNotifications.ts';
import useFilterNotifications from '@renderer/composables/useFilterNotifications.ts';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SignSingleButton from '@renderer/pages/Transactions/components/SignSingleButton.vue';
import SignGroupButton from '@renderer/pages/Transactions/components/SignGroupButton.vue';
import { getStatusFromCode, redirectToDetails, redirectToGroupDetails } from '@renderer/utils';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../../shared/src/ITransactionNode.ts';
import { NotificationType, TransactionStatus } from '@shared/interfaces';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import Tooltip from 'bootstrap/js/dist/tooltip';

/* Props */
const props = defineProps<{
  collection: TransactionNodeCollection;
  node: ITransactionNode;
  index: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionSigned', transactionId: number): void;
  (event: 'transactionGroupSigned', groupId: number): void;
}>();

/* Stores */
const notifications = useNotificationsStore();

/* State */
const descriptionRef = ref<HTMLElement | null>(null);
const isTruncated = ref(false);
let resizeObserver: ResizeObserver | null = null;

/* Composables */
const router = useRouter();
const createTooltips = useCreateTooltips();

/* Computed */
const hasNotifications = computed(() => {
  return notificationMonitor.filteredNotifications.value.length > 0;
});
const filteringNotificationType = computed(() => {
  let result: NotificationType | null;
  switch (props.collection) {
    case TransactionNodeCollection.READY_FOR_REVIEW:
      result = NotificationType.TRANSACTION_INDICATOR_APPROVE;
      break;
    case TransactionNodeCollection.READY_TO_SIGN:
      result = NotificationType.TRANSACTION_INDICATOR_SIGN;
      break;
    case TransactionNodeCollection.READY_FOR_EXECUTION:
      result = NotificationType.TRANSACTION_INDICATOR_EXECUTABLE;
      break;
    case TransactionNodeCollection.IN_PROGRESS:
    case TransactionNodeCollection.HISTORY:
      result = null;
      break;
  }
  return result;
});
const notificationMonitor = useFilterNotifications(
  computed(() => props.node),
  filteringNotificationType,
);

const transactionType = computed(() => {
  let result: string;
  if (props.node.transactionType) {
    result = getTransactionTypeFromBackendType(props.node.transactionType, false, true);
  } else if (props.node.groupItemCount) {
    const groupItemCount = props.node.groupItemCount;
    const groupCollectedCount = props.node.groupCollectedCount ?? groupItemCount;
    if (groupItemCount !== groupCollectedCount) {
      result = 'Group (' + groupCollectedCount + ' of ' + groupItemCount + ')';
    } else {
      result = 'Group (' + props.node.groupItemCount + ')';
    }
  } else {
    result = '?';
  }
  return result;
});

const validStartDate = computed(() => {
  return new Date(props.node.validStart);
});

const executedAtDate = computed(() => {
  return props.node.executedAt ? new Date(props.node.executedAt) : undefined;
});

const status = computed(() => {
  let result: string | undefined;
  if (props.node.statusCode) {
    // Transaction has been executed
    result = getStatusFromCode(props.node.statusCode) ?? undefined;
  } else if (props.node.status) {
    result = props.node.status;
  } else {
    result = undefined;
  }
  return result;
});

const isDangerStatus = computed(() => {
  let result: boolean;
  if (props.node.statusCode) {
    result = ![0, 22, 104].includes(props.node.statusCode);
  } else if (props.node.status) {
    result = props.node.status !== TransactionStatus.ARCHIVED;
  } else {
    result = false;
  }
  return result;
});

/* Handlers */
const handleDetails = async () => {
  if (notificationMonitor.filteredNotificationIds.value.length > 0) {
    await notifications.markAsReadIds(notificationMonitor.filteredNotificationIds.value);
  }
  if (props.node.transactionId) {
    redirectToDetails(router, props.node.transactionId, true);
  } else if (props.node.groupId) {
    await redirectToGroupDetails(router, props.node.groupId, 'readyToSign');
  }
};

/* Functions */
function checkTruncation() {
  if (!descriptionRef.value) {
    return;
  }
  const wasTruncated = isTruncated.value;
  const isNowTruncated = descriptionRef.value.scrollHeight > descriptionRef.value.clientHeight;
  isTruncated.value = isNowTruncated;

  const tooltip = Tooltip.getInstance(descriptionRef.value);

  if (!isNowTruncated && tooltip) {
    tooltip.dispose();
  } else if (!wasTruncated && isNowTruncated) {
    nextTick(() => createTooltips());
  }
}

/* Hooks */
onMounted(() => {
  nextTick(() => {
    if (descriptionRef.value) {
      checkTruncation();
      resizeObserver = new ResizeObserver(checkTruncation);
      resizeObserver.observe(descriptionRef.value);
    }
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

/* Watchers */
watch(() => props.node.description, () => {
  nextTick(() => checkTruncation());
});
</script>

<template>
  <tr :class="{ highlight: hasNotifications }">
    <!-- Column #1 : Transaction Id -->
    <td :data-testid="`td-transaction-node-transaction-id-${index}`">
      <TransactionId
        v-if="props.node.sdkTransactionId"
        :transaction-id="props.node.sdkTransactionId"
        wrap
      />
      <i v-else class="bi bi-stack" />
    </td>

    <!-- Column #2 : Transaction Type / Group -->
    <td :data-testid="`td-transaction-node-transaction-type-${index}`" class="text-bold">
      {{ transactionType }}
    </td>

    <!-- Column #3 : Description -->
    <td>
      <span 
        ref="descriptionRef"
        class="text-wrap-two-line-ellipsis"
        :data-bs-toggle="isTruncated ? 'tooltip' : ''"
        data-bs-custom-class="wide-tooltip"
        data-bs-trigger="hover"
        data-bs-placement="top"
        :data-bs-title="isTruncated ? props.node.description : ''"
      >
        {{ props.node.description }}
      </span>
    </td>

    <template v-if="props.collection === TransactionNodeCollection.HISTORY">
      <!-- Column #4 : Status -->
      <td :data-testid="`td-transaction-node-transaction-status-${index}`">
        <span
          v-if="status"
          class="badge bg-success text-break"
          :class="{
            'bg-danger': isDangerStatus,
          }"
          >{{ status }}</span
        >
      </td>

      <!-- Column #5 : Executed At-->
      <td :data-testid="`td-transaction-node-transaction-executed-at-${index}`">
        <span class="text-small text-secondary">
          <DateTimeString v-if="executedAtDate" :date="executedAtDate" compact wrap />
          <span v-else>N/A</span>
        </span>
      </td>
    </template>
    <template v-else>
      <!-- Column #4 : Valid Start -->
      <td :data-testid="`td-transaction-node-valid-start-${index}`">
        <DateTimeString :date="validStartDate" compact wrap />
      </td>
    </template>

    <!-- Column #5 : Actions -->
    <td class="text-center">
      <div class="d-flex justify-content-center gap-4">
        <template v-if="props.collection === TransactionNodeCollection.READY_TO_SIGN">
          <SignSingleButton
            v-if="props.node.transactionId"
            :data-testid="`button-transaction-node-sign-${index}`"
            :transactionId="props.node.transactionId"
            @transactionSigned="(tid: number) => emit('transactionSigned', tid)"
          />
          <SignGroupButton
            v-if="props.node.groupId"
            :data-testid="`button-transaction-node-sign-${index}`"
            :group-id="props.node.groupId"
            @transactionGroupSigned="(gid: number) => emit('transactionGroupSigned', gid)"
          />
        </template>
        <AppButton
          :data-testid="`button-transaction-node-details-${index}`"
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
