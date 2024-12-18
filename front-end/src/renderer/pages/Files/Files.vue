<script setup lang="ts">
import type { HederaFile } from '@prisma/client';

import { computed, onMounted, ref, watch } from 'vue';

import { Client, FileId, FileInfo } from '@hashgraph/sdk';

import { Prisma } from '@prisma/client';

import { DISPLAY_FILE_SIZE_LIMIT } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { getAll, remove, showStoredFileInTemp, update } from '@renderer/services/filesService';
import { flattenKeyList, getKeyListLevels } from '@renderer/services/keyPairService';

import { convertBytes, getUInt8ArrayFromBytesString, isUserLoggedIn } from '@renderer/utils';
import { getFormattedDateFromTimestamp } from '@renderer/utils/transactions';

import { transactionTypeKeys } from '@renderer/components/Transaction/Create/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const createTooltips = useCreateTooltips();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

// const specialFiles: HederaFile[] = [
//   {
//     id: '0.0.101',
//     file_id: '0.0.101',
//     nickname: 'Address Book',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.102',
//     file_id: '0.0.102',
//     nickname: 'Nodes Details',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.111',
//     file_id: '0.0.111',
//     nickname: 'Fee Schedules',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.112',
//     file_id: '0.0.112',
//     nickname: 'Exchange Rate Set',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.121',
//     file_id: '0.0.121',
//     nickname: 'Application Properties',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.122',
//     file_id: '0.0.122',
//     nickname: 'API Permission Properties',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
//   {
//     id: '0.0.123',
//     file_id: '0.0.123',
//     nickname: 'Throttle Definitions',
//     user_id: '0x',
//     description: null,
//     metaBytes: null,
//     contentBytes: null,
//     lastRefreshed: null,
//     network: 'testnet',
//   },
// ];
// const specialFilesIds = specialFiles.map(f => f.file_id);

/* State */
// const files = ref<HederaFile[]>(specialFiles);
const files = ref<HederaFile[]>([]);
const selectedFile = ref<HederaFile | null>(null);
const selectedFileDisplayContent = ref<string | null>(null);
const isUnlinkFileModalShown = ref(false);
const isKeyStructureModalShown = ref(false);
const isNicknameInputShown = ref(false);
const selectedFileIds = ref<string[]>([]);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const isDescriptionInputShown = ref(false);
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);
const sorting = ref<{
  [key: string]: Prisma.SortOrder;
}>({
  created_at: 'desc',
});
const selectMany = ref(false);

/* Computed */
const selectedFileInfo = computed(() =>
  selectedFile.value?.metaBytes
    ? FileInfo.fromBytes(getUInt8ArrayFromBytesString(selectedFile.value.metaBytes))
    : null,
);
const selectedFileIdWithChecksum = computed(
  () =>
    selectedFile.value &&
    FileId.fromString(selectedFile.value?.file_id)
      .toStringWithChecksum(network.client as Client)
      .split('-'),
);

const allSelected = computed(() => {
  return selectedFileIds.value.length > 0 && selectedFileIds.value.length === files.value.length;
});

/* Composables */
const toast = useToast();

/* Handlers */
const handleSelectFile = (fileId: string) => {
  isNicknameInputShown.value = false;

  if (selectMany.value) {
    selectedFileIds.value = selectedFileIds.value.includes(fileId)
      ? selectedFileIds.value.filter(f => f !== fileId)
      : [...selectedFileIds.value, fileId];
  } else {
    selectedFile.value = files.value.find(f => f.file_id === fileId) || null;
    selectedFileIds.value = [fileId];
    syncSelectedFileDisplayContent();
  }
};

const handleCheckBoxUpdate = (isChecked: boolean, fileId: string) => {
  if (isChecked) {
    selectedFileIds.value.push(fileId);
  } else {
    selectedFileIds.value = selectedFileIds.value.filter(f => f !== fileId);

    if (selectedFile.value?.file_id === fileId) {
      selectedFile.value =
        selectedFileIds.value.length > 0
          ? files.value.find(f => f.file_id === selectedFileIds.value[0]) || null
          : files.value[0] || null;
    }
  }
};

const handleUnlinkFile = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (!selectedFile.value) {
    throw new Error('Please select file first');
  }

  await remove(user.personal.id, [...selectedFileIds.value]);
  await fetchFiles();

  resetSelectedAccount();

  isUnlinkFileModalShown.value = false;

  selectedFileIds.value = [];
  toast.success('File Unlinked!');
};

const handleStartNicknameEdit = () => {
  if (!selectedFile.value) return;

  isNicknameInputShown.value = true;
  descriptionInputRef.value?.blur();

  setTimeout(() => {
    if (nicknameInputRef.value) {
      createTooltips();
      if (nicknameInputRef.value.inputRef) {
        nicknameInputRef.value.inputRef.value = selectedFile.value?.nickname || '';
      }
      nicknameInputRef.value?.inputRef?.focus();
    }
  }, 100);
};

const handleChangeNickname = async () => {
  isNicknameInputShown.value = false;

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (selectedFile.value) {
    await update(selectedFile.value.file_id, user.personal.id, {
      nickname: nicknameInputRef.value?.inputRef?.value,
    });
    await fetchFiles();
  }
};

const handleStartDescriptionEdit = () => {
  if (!selectedFile.value) return;

  isDescriptionInputShown.value = true;
  nicknameInputRef.value?.inputRef?.blur();

  setTimeout(() => {
    if (descriptionInputRef.value) {
      createTooltips();
      descriptionInputRef.value?.focus();
    }
  }, 50);
};

const handleChangeDescription = async () => {
  isDescriptionInputShown.value = false;

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (selectedFile.value) {
    await update(selectedFile.value.file_id, user.personal.id, {
      description: descriptionInputRef.value?.value,
    });
    await fetchFiles();
  }
};

const handleSortFiles = async (
  property: keyof Prisma.HederaFileOrderByWithRelationInput,
  order: Prisma.SortOrder,
) => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  sorting.value = {
    [property]: order,
  };

  await fetchFiles();
};

const handleSelectAllFiles = () => {
  if (!allSelected.value) {
    selectedFileIds.value = files.value.map(file => file.file_id);
  } else {
    selectedFileIds.value = [];
  }
};

const handleToggleSelectMode = () => {
  selectMany.value = !selectMany.value;
  if (selectMany.value === false) {
    selectedFileIds.value = files.value.length > 0 ? [files.value[0].file_id] : [];
  } else {
    selectedFileIds.value = [];
  }
};

/* Functions */
async function fetchFiles() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  files.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
    orderBy: { ...sorting.value },
  });
}

function resetSelectedAccount() {
  selectedFile.value = files.value[0] || null;
  selectedFileIds.value = selectedFile.value?.file_id ? [selectedFile.value?.file_id] : [];
}

function syncSelectedFileDisplayContent() {
  const content = getUInt8ArrayFromBytesString(selectedFile.value?.contentBytes || '');

  try {
    if (
      selectedFile.value === null ||
      content.length === 0 ||
      content.length > DISPLAY_FILE_SIZE_LIMIT
    ) {
      throw new Error('File content is empty or too large');
    }

    selectedFileDisplayContent.value = new TextDecoder().decode(content);
  } catch {
    selectedFileDisplayContent.value = null;
  }
}

/* Hooks */
onMounted(async () => {
  await fetchFiles();
  resetSelectedAccount();
  syncSelectedFileDisplayContent();
});

/* Watchers */
watch(files, newFiles => {
  selectedFile.value = newFiles.find(f => f.file_id === selectedFile.value?.file_id) || newFiles[0];
});
</script>

<template>
  <div class="px-4 px-xxl-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between align-items-center">
        <h1 class="text-title text-bold">Files</h1>
      </div>
      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <div class="dropdown">
            <AppButton
              color="primary"
              size="large"
              class="w-100"
              data-testid="button-add-new-file"
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
                <span class="text-small text-bold" data-testid="link-create-new-file"
                  >Create New</span
                >
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
                <span class="text-small text-bold" data-testid="link-update-file">Update</span>
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
                <span class="text-small text-bold" data-testid="link-append-file">Append</span>
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
                <span class="text-small text-bold" data-testid="link-read-file">Read</span>
              </li>
              <li
                class="dropdown-item cursor-pointer mt-3"
                @click="$router.push('files/link-existing')"
              >
                <span class="text-small text-bold" data-testid="link-add-existing-file"
                  >Add Existing</span
                >
              </li>
            </ul>
          </div>

          <div class="d-flex align-items-center justify-content-between my-3">
            <div class="dropdown">
              <AppButton
                class="d-flex align-items-center text-dark-emphasis min-w-unset border-0 p-0"
                data-bs-toggle="dropdown"
                ><i class="bi bi-arrow-down-up me-2"></i> Sort by</AppButton
              >
              <ul class="dropdown-menu text-small">
                <li
                  class="dropdown-item"
                  :selected="sorting.file_id === 'asc' ? true : undefined"
                  @click="handleSortFiles('file_id', 'asc')"
                >
                  File ID Asc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.account_id === 'desc' ? true : undefined"
                  @click="handleSortFiles('file_id', 'desc')"
                >
                  File ID Dsc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.nickname === 'asc' ? true : undefined"
                  @click="handleSortFiles('nickname', 'asc')"
                >
                  Nickname A-Z
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.nickname === 'desc' ? true : undefined"
                  @click="handleSortFiles('nickname', 'desc')"
                >
                  Nickname Z-A
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.created_at === 'asc' ? true : undefined"
                  @click="handleSortFiles('created_at', 'asc')"
                >
                  Date Added Asc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.created_at === 'desc' ? true : undefined"
                  @click="handleSortFiles('created_at', 'desc')"
                >
                  Date Added Dsc
                </li>
              </ul>
            </div>
            <div class="transition-bg rounded px-3" :class="{ 'bg-secondary': selectMany }">
              <AppButton
                class="d-flex align-items-center text-dark-emphasis min-w-unset border-0 p-1"
                data-testid="button-select-many-files"
                @click="handleToggleSelectMode"
              >
                <i class="bi bi-check-all text-headline me-2"></i> Select</AppButton
              >
            </div>
          </div>
          <hr class="separator mb-5" />

          <div class="fill-remaining pe-3">
            <div v-if="selectMany" class="d-flex flex-row align-items-center flex-nowrap mb-4">
              <div class="d-flex cursor-pointer" @click="handleSelectAllFiles">
                <AppCheckBox
                  name="select-card"
                  class="cursor-pointer"
                  type="checkbox"
                  :checked="allSelected"
                />
                <span class="ms-4">Select all</span>
              </div>
              <AppButton
                size="small"
                class="min-w-unset ms-auto"
                color="danger"
                :disabled="selectedFileIds.length < 1"
                data-testid="button-remove-multiple-files"
                @click="isUnlinkFileModalShown = true"
                ><span class="bi bi-trash"></span
              ></AppButton>
            </div>
            <template v-for="(file, index) in files" :key="file.fileId">
              <div class="d-flex align-items-center mt-3">
                <div
                  v-if="selectMany"
                  :selected="selectedFileIds.includes(file.file_id) ? true : undefined"
                >
                  <AppCheckBox
                    :checked="selectedFileIds.includes(file.file_id)"
                    @update:checked="handleCheckBoxUpdate($event, file.file_id)"
                    :data-testid="'checkbox-multiple-file-id-' + index"
                    name="select-card"
                    class="cursor-pointer"
                  />
                </div>
                <div
                  class="container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-4"
                  :class="{
                    'is-selected': selectedFileIds.includes(file.file_id),
                  }"
                  @click="handleSelectFile(file.file_id)"
                >
                  <p class="text-small text-semi-bold overflow-hidden">{{ file.nickname }}</p>
                  <div class="d-flex justify-content-between align-items-center">
                    <p class="text-micro text-secondary mt-2" :data-testid="'p-file-id-' + index">
                      {{ file.file_id }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div v-if="selectedFile" class="container-fluid flex-column-100 position-relative">
              <div class="flex-between-centered flex-wrap gap-3">
                <div class="d-flex align-items-center flex-wrap gap-3">
                  <AppInput
                    v-if="isNicknameInputShown"
                    ref="nicknameInputRef"
                    @blur="handleChangeNickname"
                    :filled="true"
                    placeholder="Enter Nickname"
                    data-bs-toggle="tooltip"
                    data-bs-placement="left"
                    data-bs-custom-class="wide-tooltip"
                    data-bs-title="This information is not stored on the network"
                  />
                  <p
                    v-if="!isNicknameInputShown"
                    class="text-title text-semi-bold py-3"
                    @dblclick="handleStartNicknameEdit"
                  >
                    {{ selectedFile?.nickname || 'None' }}

                    <!-- <span
                      v-if="!specialFilesIds.includes(selectedFile.file_id)"
                      class="bi bi-pencil-square text-primary text-main cursor-pointer ms-1"
                      @click="handleStartNicknameEdit"
                    ></span> -->
                    <span
                      class="bi bi-pencil-square text-primary text-main cursor-pointer ms-1"
                      @click="handleStartNicknameEdit"
                    ></span>
                  </p>
                </div>
                <div v-if="selectedFile && !selectMany" class="d-flex gap-3">
                  <AppButton
                    class="min-w-unset"
                    color="danger"
                    @click="isUnlinkFileModalShown = true"
                    data-testid="button-remove-file-card"
                    ><span class="bi bi-trash"></span> Remove</AppButton
                  >
                  <div class="border-start ps-3">
                    <AppButton
                      class="min-w-unset"
                      color="borderless"
                      data-testid="button-update-file"
                      @click="
                        $router.push({
                          name: 'createTransaction',
                          params: { type: transactionTypeKeys.updateFile },
                          query: { fileId: selectedFile?.file_id },
                        })
                      "
                      ><span class="bi bi-arrow-repeat"></span> Update</AppButton
                    >
                  </div>
                  <div class="border-start ps-3">
                    <AppButton
                      class="min-w-unset"
                      color="borderless"
                      data-testid="button-append-file"
                      @click="
                        $router.push({
                          name: 'createTransaction',
                          params: { type: transactionTypeKeys.appendToFile },
                          query: { fileId: selectedFile?.file_id },
                        })
                      "
                      ><span class="bi bi-plus-square-dotted"></span> Append</AppButton
                    >
                  </div>
                  <div class="border-start ps-3">
                    <AppButton
                      class="min-w-unset"
                      color="borderless"
                      data-testid="button-read-file"
                      @click="
                        $router.push({
                          name: 'createTransaction',
                          params: { type: transactionTypeKeys.readFile },
                          query: { fileId: selectedFile?.file_id },
                        })
                      "
                      ><span class="bi bi-book"></span> Read</AppButton
                    >
                  </div>
                </div>
              </div>

              <p class="text-secondary text-small text-semi-bold mt-3">
                <template v-if="selectedFile.lastRefreshed">
                  Last Viewed:
                  <span>{{ selectedFile.lastRefreshed.toDateString() }}</span>
                </template>
                <template v-else> You haven't read this file yet </template>
              </p>

              <hr class="separator my-4" />

              <div class="fill-remaining overflow-x-hidden pe-3">
                <div class="row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">File ID</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-file-id-info">
                      <template
                        v-if="
                          selectedFileIdWithChecksum && Array.isArray(selectedFileIdWithChecksum)
                        "
                      >
                        <span>{{ selectedFileIdWithChecksum[0] }}</span>
                        <span class="text-secondary">-{{ selectedFileIdWithChecksum[1] }}</span>
                      </template>
                      <template v-else
                        ><span>{{ selectedFileIdWithChecksum }}</span></template
                      >
                    </p>
                  </div>
                </div>

                <div class="mt-4 row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Size</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small" data-testid="p-file-size">
                      {{
                        selectedFileInfo?.size
                          ? convertBytes(selectedFileInfo.size.toNumber(), {
                              decimals: 0,
                            })
                          : 'Unknown'
                      }}
                    </p>
                  </div>
                </div>

                <div
                  class="mt-4 row"
                  v-if="selectedFile.contentBytes && !selectedFileDisplayContent"
                >
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Content</p>
                  </div>
                  <div class="col-7">
                    <AppButton
                      color="primary"
                      size="small"
                      @click="
                        isUserLoggedIn(user.personal) &&
                        showStoredFileInTemp(user.personal.id, selectedFile.file_id)
                      "
                      >View</AppButton
                    >
                  </div>
                </div>

                <div class="mt-4 row" v-if="selectedFileInfo?.keys">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Key</p>
                  </div>
                  <div class="col-7">
                    <template v-if="flattenKeyList(selectedFileInfo.keys).length > 1">
                      Complex Key ({{ getKeyListLevels(selectedFileInfo.keys) }} levels)
                      <span
                        class="link-primary cursor-pointer"
                        @click="isKeyStructureModalShown = true"
                        >See details</span
                      >
                    </template>
                    <template v-else>
                      <p class="text-secondary text-small overflow-hidden" data-testid="p-file-key">
                        {{ flattenKeyList(selectedFileInfo.keys)[0].toStringRaw() }}
                      </p>
                      <p
                        class="text-small text-semi-bold text-pink mt-3"
                        data-testid="p-file-key-type"
                      >
                        {{ flattenKeyList(selectedFileInfo.keys)[0]._key._type }}
                      </p>
                    </template>
                  </div>
                </div>

                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Memo</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-file-memo">
                      {{
                        selectedFileInfo
                          ? selectedFileInfo.fileMemo.length > 0
                            ? selectedFileInfo.fileMemo
                            : 'None'
                          : 'Unknown'
                      }}
                    </p>
                  </div>
                </div>

                <div class="mt-4 row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Ledger ID</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-file-ledger-id">
                      {{ selectedFileInfo?.ledgerId || 'Unknown' }}
                    </p>
                  </div>
                </div>

                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Expires At</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-file-expires-at">
                      {{
                        selectedFileInfo?.expirationTime
                          ? getFormattedDateFromTimestamp(selectedFileInfo?.expirationTime)
                          : 'Unknown'
                      }}
                    </p>
                  </div>
                </div>
                <template v-if="selectedFileInfo?.isDeleted">
                  <hr class="separator my-4" />
                  <p class="text-danger">File is deleted</p>
                </template>

                <hr class="separator my-4" />

                <div class="mt-4 row align-items-start">
                  <div class="col-5">
                    <div class="text-small text-semi-bold">Description</div>
                  </div>
                  <div class="col-7">
                    <textarea
                      v-if="isDescriptionInputShown"
                      ref="descriptionInputRef"
                      class="form-control is-fill"
                      rows="8"
                      v-model="selectedFile.description"
                      @blur="handleChangeDescription"
                      data-bs-toggle="tooltip"
                      data-bs-placement="left"
                      data-bs-custom-class="wide-tooltip"
                      data-bs-title="This information is not stored on the network"
                    >
                    </textarea>
                    <p
                      v-if="!isDescriptionInputShown"
                      data-testid="p-file-description"
                      class="text-small text-semi-bold text-wrap"
                      @dblclick="handleStartDescriptionEdit"
                    >
                      {{ selectedFile?.description || 'None' }}

                      <!-- <span
                        v-if="!specialFilesIds.includes(selectedFile.file_id)"
                        class="bi bi-pencil-square text-primary ms-1 cursor-pointer"
                        @click="handleStartDescriptionEdit"
                      ></span> -->
                      <span
                        class="bi bi-pencil-square text-primary ms-1 cursor-pointer"
                        @click="handleStartDescriptionEdit"
                      ></span>
                    </p>
                  </div>
                </div>

                <div class="mt-4" v-if="selectedFileDisplayContent">
                  <div>
                    <p class="text-small text-semi-bold">Content</p>
                  </div>
                  <div class="mt-2">
                    <textarea
                      :value="selectedFileDisplayContent"
                      class="form-control is-fill"
                      rows="11"
                      disabled
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <KeyStructureModal
            v-if="selectedFileInfo"
            v-model:show="isKeyStructureModalShown"
            :account-key="selectedFileInfo.keys"
          />
        </div>
        <AppModal v-model:show="isUnlinkFileModalShown" class="common-modal">
          <div class="p-4">
            <i class="bi bi-x-lg cursor-pointer" @click="isUnlinkFileModalShown = false"></i>
            <div class="text-center">
              <AppCustomIcon :name="'bin'" style="height: 160px" />
            </div>
            <h3 class="text-center text-title text-bold mt-3">
              Unlink file{{ selectedFileIds.length > 1 ? 's' : '' }}
            </h3>
            <p class="text-center text-small text-secondary mt-4">
              Are you sure you want to remove
              {{ selectedFileIds.length > 1 ? 'these' : 'this' }} File{{
                selectedFileIds.length > 1 ? 's' : ''
              }}
              from your File list?
            </p>
            <hr class="separator my-5" />
            <div class="flex-between-centered gap-4">
              <AppButton color="borderless" @click="isUnlinkFileModalShown = false"
                >Cancel</AppButton
              >
              <AppButton
                color="danger"
                @click="handleUnlinkFile"
                data-testid="button-confirm-unlink-file"
                >Unlink</AppButton
              >
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  </div>
</template>
