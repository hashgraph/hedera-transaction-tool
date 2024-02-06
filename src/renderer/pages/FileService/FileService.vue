<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '../../components/ui/AppButton.vue';

// TODO: Replace with real data from SQLLite (temp solution) or BE DB
/* State */
const files = ref([
  {
    fileId: '0.0.101',
    fileName: 'Address Book',
  },
  {
    fileId: '0.0.102',
    fileName: 'Nodes Details',
  },
  {
    fileId: '0.0.111',
    fileName: 'Fee Schedules',
  },
  {
    fileId: '0.0.112',
    fileName: 'Exchange Rate Set',
  },
  {
    fileId: '0.0.121',
    fileName: 'Application Properties',
  },
  {
    fileId: '0.0.122',
    fileName: 'API Permission Properties',
  },
  {
    fileId: '0.0.123',
    fileName: 'Throttle Definitions',
  },
]);
const selectedFileId = ref('0.0.101');

/* Handlers */
const handleFileItemClick = fileId => {
  selectedFileId.value = fileId;
};
</script>

<template>
  <div class="p-5">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="text-title text-bold">File Service</h1>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          class="me-3"
          color="secondary"
          @click="
            $router.push({
              name: 'createTransaction',
              params: { type: 'updateFile' },
              query: { fileId: selectedFileId },
            })
          "
          >Update</AppButton
        >

        <AppButton
          color="secondary"
          @click="
            $router.push({
              name: 'createTransaction',
              params: { type: 'readFile' },
              query: { fileId: selectedFileId },
            })
          "
          >Read</AppButton
        >
      </div>
    </div>
    <div class="mt-7 h-100 row">
      <div class="col-4 col-xxl-3 with-border-end pe-4 ps-0">
        <div class="dropdown">
          <AppButton
            color="primary"
            size="large"
            class="w-100 d-flex align-items-center justify-content-center"
            data-bs-toggle="dropdown"
            >Add new</AppButton
          >
          <ul class="dropdown-menu w-100 mt-3">
            <li
              class="dropdown-item cursor-pointer"
              @click="$router.push('create-transaction/createFile')"
            >
              <span class="text-small text-bold">Create New</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="$router.push('create-transaction/updateFile')"
            >
              <span class="text-small text-bold">Update</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="$router.push('create-transaction/appendToFile')"
            >
              <span class="text-small text-bold">Append</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="$router.push('create-transaction/readFile')"
            >
              <span class="text-small text-bold">Read</span>
            </li>
          </ul>
        </div>

        <hr class="separator my-5" />

        <div>
          <template v-for="file in files" :key="file.accountId">
            <div
              class="container-card-account p-4 mt-3"
              :class="{
                'is-selected': selectedFileId === file.fileId,
              }"
              @click="handleFileItemClick(file.fileId)"
            >
              <p class="text-small text-semi-bold">{{ file.fileName }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <p class="text-micro text-secondary mt-2">{{ file.fileId }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="col-8 col-xxl-9 ps-4 pt-0"></div>
    </div>
  </div>
</template>
