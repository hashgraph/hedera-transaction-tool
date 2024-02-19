<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { HederaFile } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { getAll, remove } from '@renderer/services/filesService';

import { transactionTypeKeys } from '@renderer/pages/CreateTransaction/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();

// TODO: Replace with real data from SQLite (temp solution) or BE DB
const specialFiles: HederaFile[] = [
  {
    id: '0.0.101',
    file_id: '0.0.101',
    nickname: 'Address Book',
    user_id: user.data.id,
  },
  {
    id: '0.0.102',
    file_id: '0.0.102',
    nickname: 'Nodes Details',
    user_id: user.data.id,
  },
  {
    id: '0.0.111',
    file_id: '0.0.111',
    nickname: 'Fee Schedules',
    user_id: user.data.id,
  },
  {
    id: '0.0.112',
    file_id: '0.0.112',
    nickname: 'Exchange Rate Set',
    user_id: user.data.id,
  },
  {
    id: '0.0.121',
    file_id: '0.0.121',
    nickname: 'Application Properties',
    user_id: user.data.id,
  },
  {
    id: '0.0.122',
    file_id: '0.0.122',
    nickname: 'API Permission Properties',
    user_id: user.data.id,
  },
  {
    id: '0.0.123',
    file_id: '0.0.123',
    nickname: 'Throttle Definitions',
    user_id: user.data.id,
  },
];
/* State */
const files = ref<HederaFile[]>(specialFiles);
const selectedFileId = ref('0.0.101');
const isUnlinkFileModalShown = ref(false);

/* Composables */
const toast = useToast();

/* Handlers */
const handleFileItemClick = fileId => {
  selectedFileId.value = fileId;
};

const handleUnlinkFile = async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  files.value = specialFiles.concat(await remove(user.data.id, selectedFileId.value));

  isUnlinkFileModalShown.value = false;

  toast.success('File Unlinked!', { position: 'bottom-right' });
};

/* Hooks */
onMounted(async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  files.value = files.value.concat(await getAll(user.data.id));
});
</script>

<template>
  <div class="p-5">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="text-title text-bold">Files</h1>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton class="me-3" color="secondary" @click="isUnlinkFileModalShown = true"
          >Remove</AppButton
        >
        <AppButton
          class="me-3"
          color="secondary"
          @click="
            $router.push({
              name: 'createTransaction',
              params: { type: transactionTypeKeys.updateFile },
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
              params: { type: transactionTypeKeys.readFile },
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
              @click="
                $router.push({
                  name: 'createTransaction',
                  params: {
                    type: transactionTypeKeys.createFile,
                  },
                })
              "
            >
              <span class="text-small text-bold">Create New</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="
                $router.push({
                  name: 'createTransaction',
                  params: {
                    type: transactionTypeKeys.updateFile,
                  },
                })
              "
            >
              <span class="text-small text-bold">Update</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="
                $router.push({
                  name: 'createTransaction',
                  params: {
                    type: transactionTypeKeys.appendToFile,
                  },
                })
              "
            >
              <span class="text-small text-bold">Append</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="
                $router.push({
                  name: 'createTransaction',
                  params: {
                    type: transactionTypeKeys.readFile,
                  },
                })
              "
            >
              <span class="text-small text-bold">Read</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="$router.push('files/link-existing')"
            >
              <span class="text-small text-bold">Add Existing</span>
            </li>
          </ul>
        </div>

        <hr class="separator my-5" />

        <div>
          <template v-for="file in files" :key="file.fileId">
            <div
              class="container-card-account p-4 mt-3"
              :class="{
                'is-selected': selectedFileId === file.file_id,
              }"
              @click="handleFileItemClick(file.file_id)"
            >
              <p class="text-small text-semi-bold">{{ file.nickname }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <p class="text-micro text-secondary mt-2">{{ file.file_id }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="col-8 col-xxl-9 ps-4 pt-0"></div>
      <AppModal v-model:show="isUnlinkFileModalShown" class="common-modal">
        <div class="modal-body">
          <i class="bi bi-x-lg cursor-pointer" @click="isUnlinkFileModalShown = false"></i>
          <div class="text-center mt-5">
            <i class="bi bi-trash large-icon"></i>
          </div>
          <h3 class="text-center text-title text-bold mt-5">Unlink file</h3>
          <p class="text-center text-small text-secondary mt-4">
            Are you sure you want to remove this file from your file list?
          </p>
          <hr class="separator my-5" />
          <div class="d-grid">
            <AppButton color="primary" @click="handleUnlinkFile">Unlink</AppButton>
            <AppButton color="secondary" class="mt-4" @click="isUnlinkFileModalShown = false"
              >Cancel</AppButton
            >
          </div>
        </div>
      </AppModal>
    </div>
  </div>
</template>
