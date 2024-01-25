<script setup lang="ts">
import { ref } from 'vue';

const data = ref([
  {
    type: 'Transfer',
    status: 'Success',
    timestamp: Date.now(),
  },
  {
    type: 'Account update',
    status: 'Failed',
    timestamp: Date.now(),
  },
]);
</script>

<template>
  <table class="table-custom">
    <thead>
      <tr>
        <th class="w-10 text-end">#</th>
        <th>Transaction type</th>
        <th>Timestamp</th>
        <th>Status</th>
      </tr>
    </thead>

    <tbody>
      <template v-for="(item, i) in data" :key="i">
        <tr>
          <td>{{ i + 1 }}</td>
          <td>{{ item.type }}</td>
          <td>{{ item.timestamp }}</td>
          <td>Success</td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
