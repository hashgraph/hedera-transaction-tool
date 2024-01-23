<script setup lang="ts">
import { onBeforeMount, reactive, ref } from 'vue';
import { Status, Timestamp } from '@hashgraph/sdk';

import { IStoredTransaction } from '../../../../main/shared/interfaces';

import useUserStore from '../../../stores/storeUser';

import { getTransactions } from '../../../services/transactionService';

import AppButton from '../../../components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const transactions = ref<IStoredTransaction[]>([]);
const sort = reactive<{ field: string; direction: 'asc' | 'desc' }>({
  field: 'timestamp',
  direction: 'desc',
});

/* Handlers */
const handleSort = (field: string, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;

  switch (field) {
    case 'type':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.type.localeCompare(t2.type);
        } else if (direction === 'desc') {
          return t2.type.localeCompare(t1.type);
        } else return 0;
      });
      break;
    case 'status':
      transactions.value = transactions.value.sort((t1, t2) => {
        const status1 = Status._fromCode(t1.status).toString();
        const status2 = Status._fromCode(t2.status).toString();

        if (direction === 'asc') {
          return status1.localeCompare(status2);
        } else if (direction === 'desc') {
          return status2.localeCompare(status1);
        } else return 0;
      });
      break;
    case 'timestamp':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.timestamp - t2.timestamp;
        } else if (direction === 'desc') {
          return t2.timestamp - t1.timestamp;
        } else return 0;
      });
      break;
    case 'payerId':
      transactions.value = transactions.value.sort((t1, t2) => {
        const payerId1 = Number(t1.transactionId.split('@')[0].split('.').join(''));
        const payerId2 = Number(t2.transactionId.split('@')[0].split('.').join(''));

        if (direction === 'asc') {
          return payerId1 - payerId2;
        } else if (direction === 'desc') {
          return payerId2 - payerId1;
        } else return 0;
      });
      break;
    default:
      break;
  }
};

/* Functions */
const getOpositeDirection = () => (sort.direction === 'asc' ? 'desc' : 'asc');

/* Hooks */
onBeforeMount(async () => {
  transactions.value = await getTransactions(user.data.email, user.data.activeServerURL);
  handleSort('timestamp', 'desc');
  transactions.value = transactions.value.sort((t1, t2) => t2.timestamp - t1.timestamp);
});
</script>
<template>
  <div class="transactions-history-container">
    <table class="user-select-none w-100">
      <thead>
        <tr
          class="d-flex align-items-center row text-center text-small bg-body-secondary rounded-4 py-4"
        >
          <th class="col-1">#</th>
          <th
            class="col-4 col-xl-3 d-flex justify-content-center align-items-center"
            @click="handleSort('type', sort.field === 'type' ? getOpositeDirection() : 'asc')"
          >
            <span>Transaction Type</span>
            <i
              v-if="sort.field === 'type'"
              class="bi text-title lh-1"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </th>
          <th
            class="col-3 col-xl-2 d-flex justify-content-center align-items-center"
            @click="handleSort('status', sort.field === 'status' ? getOpositeDirection() : 'asc')"
          >
            <span>Status</span>
            <i
              v-if="sort.field === 'status'"
              class="bi text-title lh-1"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </th>
          <th
            class="col-2 d-flex justify-content-center align-items-center"
            @click="handleSort('payerId', sort.field === 'payerId' ? getOpositeDirection() : 'asc')"
          >
            <span>Payer ID</span>
            <i
              v-if="sort.field === 'payerId'"
              class="bi text-title lh-1"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </th>
          <th
            class="d-none d-xl-flex col-xl-2 justify-content-center align-items-center"
            @click="
              handleSort('timestamp', sort.field === 'timestamp' ? getOpositeDirection() : 'asc')
            "
          >
            <span>Timestamp</span>
            <i
              v-if="sort.field === 'timestamp'"
              class="bi text-title lh-1"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </th>
          <th class="col-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(transaction, i) in transactions" :key="i">
          <tr
            class="d-flex align-items-center row text-center text-small bg-secondary-subtle rounded-4 py-4 my-3"
          >
            <td class="col-1 overflow-hidden">{{ i + 1 }}</td>
            <td class="col-4 col-xl-3 overflow-hidden">{{ transaction.type }}</td>
            <td class="col-3 col-xl-2 overflow-hidden">
              <span
                class="badge bg-success text-break d-inline-block"
                :class="{ 'bg-danger': ![0, 22].includes(transaction.status) }"
                :style="{ whiteSpace: 'normal', maxHeight: 'none' }"
                >{{ Status._fromCode(transaction.status).toString().split('_').join(' ') }}</span
              >
            </td>
            <td class="col-2 overflow-hidden">{{ transaction.transactionId.split('@')[0] }}</td>
            <td class="d-none d-xl-block col-xl-2 overflow-hidden">
              {{
                new Timestamp(
                  transaction.transactionId.split('@')[1].split('.')[0],
                  transaction.transactionId.split('@')[1].split('.')[1],
                )
                  .toDate()
                  .toDateString()
              }}
            </td>
            <td class="col-2 overflow-hidden"><AppButton color="primary">Details</AppButton></td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
