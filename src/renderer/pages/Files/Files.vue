<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { FileId, FileInfo } from '@hashgraph/sdk';

import { HederaFile } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { getAll, remove, showContentInTemp, update } from '@renderer/services/filesService';
import { flattenKeyList, getKeyListLevels } from '@renderer/services/keyPairService';

import { getUInt8ArrayFromString, convertBytes } from '@renderer/utils';
import { getFormattedDateFromTimestamp } from '@renderer/utils/transactions';

import { transactionTypeKeys } from '@renderer/pages/CreateTransaction/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const createTooltips = useCreateTooltips();

// TODO: Replace with real data from SQLite (temp solution) or BE DB
const specialFiles: HederaFile[] = [
  {
    id: '0.0.101',
    file_id: '0.0.101',
    nickname: 'Address Book',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.102',
    file_id: '0.0.102',
    nickname: 'Nodes Details',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.111',
    file_id: '0.0.111',
    nickname: 'Fee Schedules',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.112',
    file_id: '0.0.112',
    nickname: 'Exchange Rate Set',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.121',
    file_id: '0.0.121',
    nickname: 'Application Properties',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.122',
    file_id: '0.0.122',
    nickname: 'API Permission Properties',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
  {
    id: '0.0.123',
    file_id: '0.0.123',
    nickname: 'Throttle Definitions',
    user_id: user.data.id,
    description: null,
    metaBytes: null,
    contentBytes: null,
    lastRefreshed: null,
  },
];
const specialFilesIds = specialFiles.map(f => f.file_id);

/* State */
const files = ref<HederaFile[]>(specialFiles);
const selectedFile = ref<HederaFile | null>(null);
const isUnlinkFileModalShown = ref(false);
const isKeyStructureModalShown = ref(false);
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const isDescriptionInputShown = ref(false);
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);

/* Computed */
const selectedFileInfo = computed(() =>
  selectedFile.value?.metaBytes
    ? FileInfo.fromBytes(getUInt8ArrayFromString(selectedFile.value.metaBytes))
    : null,
);
const selectedFileIdWithChecksum = computed(
  () =>
    selectedFile.value &&
    FileId.fromString(selectedFile.value?.file_id).toStringWithChecksum(network.client).split('-'),
);

/* Composables */
const toast = useToast();

/* Handlers */
const handleFileItemClick = fileId => {
  selectedFile.value = files.value.find(f => f.file_id === fileId) || null;
};

const handleUnlinkFile = async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  if (!selectedFile.value) {
    throw new Error('Please select file first');
  }

  files.value = specialFiles.concat(await remove(user.data.id, selectedFile.value.file_id));

  isUnlinkFileModalShown.value = false;

  toast.success('File Unlinked!', { position: 'bottom-right' });
};

const handleStartNicknameEdit = () => {
  if (!selectedFile.value || specialFilesIds.includes(selectedFile.value.id)) return;

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

  if (selectedFile.value) {
    files.value = specialFiles.concat(
      await update(selectedFile.value.file_id, user.data.id, {
        nickname: nicknameInputRef.value?.inputRef?.value,
      }),
    );
  }
};

const handleStartDescriptionEdit = () => {
  if (!selectedFile.value || specialFilesIds.includes(selectedFile.value.id)) return;

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
  if (selectedFile.value) {
    files.value = specialFiles.concat(
      await update(selectedFile.value.file_id, user.data.id, {
        description: descriptionInputRef.value?.value,
      }),
    );
  }
};

/* Hooks */
onMounted(async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  files.value = files.value.concat(await getAll(user.data.id));
});

/* Watchers */
watch(files, newFiles => {
  selectedFile.value = newFiles.find(f => f.file_id === selectedFile.value?.file_id) || newFiles[0];
});
</script>

<template>
  <div class="px-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between align-items-center">
        <h1 class="text-title text-bold">Files</h1>
      </div>
      <div class="row g-0 overflow-hidden mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <div class="dropdown">
            <AppButton color="primary" size="large" class="w-100" data-bs-toggle="dropdown"
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

          <div class="fill-remaining pe-3">
            <template v-for="file in files" :key="file.fileId">
              <div
                class="container-card-account overflow-hidden p-4 mt-3"
                :class="{
                  'is-selected': selectedFile?.file_id === file.file_id,
                }"
                @click="handleFileItemClick(file.file_id)"
              >
                <p class="text-small text-semi-bold overflow-hidden">{{ file.nickname }}</p>
                <div class="d-flex justify-content-between align-items-center">
                  <p class="text-micro text-secondary mt-2">{{ file.file_id }}</p>
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

                    <span
                      v-if="!specialFilesIds.includes(selectedFile.file_id)"
                      class="bi bi-pencil-square text-primary text-main cursor-pointer ms-1"
                      @click="handleStartNicknameEdit"
                    ></span>
                  </p>
                  <p class="text-secondary text-small text-semi-bold">
                    <template v-if="selectedFile.lastRefreshed">
                      Last Viewed:
                      <span>{{ selectedFile.lastRefreshed.toDateString() }}</span>
                    </template>
                    <template v-else> You haven't read this file yet </template>
                  </p>
                </div>
                <div v-if="selectedFile" class="d-flex gap-3">
                  <AppButton
                    class="min-w-unset text-danger"
                    color="borderless"
                    @click="isUnlinkFileModalShown = true"
                    ><span class="bi bi-trash"></span> Remove</AppButton
                  >
                  <div class="border-start ps-3">
                    <AppButton
                      class="min-w-unset"
                      color="borderless"
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
              <hr class="separator my-4" />
              <div class="fill-remaining overflow-x-hidden pe-3">
                <div class="row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">File ID</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
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
                    <p class="text-small">
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
                <div class="mt-4 row" v-if="selectedFile.contentBytes">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Content</p>
                  </div>
                  <div class="col-7">
                    <AppButton
                      color="primary"
                      size="small"
                      @click="showContentInTemp(user.data.id, selectedFile.file_id)"
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
                      <p class="text-secondary text-small overflow-hidden">
                        {{ flattenKeyList(selectedFileInfo.keys)[0].toStringRaw() }}
                      </p>
                      <p class="text-small text-semi-bold text-pink mt-3">
                        {{ flattenKeyList(selectedFileInfo.keys)[0]._key._type }}
                      </p>
                    </template>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Memo</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
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
                    <p class="text-small text-semi-bold">
                      {{ selectedFileInfo?.ledgerId || 'Unknown' }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Expires At</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
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
                      class="text-small text-semi-bold text-wrap"
                      @dblclick="handleStartDescriptionEdit"
                    >
                      {{ selectedFile?.description || 'None' }}

                      <span
                        v-if="!specialFilesIds.includes(selectedFile.file_id)"
                        class="bi bi-pencil-square text-primary ms-1 cursor-pointer"
                        @click="handleStartDescriptionEdit"
                      ></span>
                    </p>
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
          <div class="modal-body">
            <i class="bi bi-x-lg cursor-pointer" @click="isUnlinkFileModalShown = false"></i>
            <div class="text-center">
              <AppCustomIcon :name="'bin'" style="height: 160px" />
            </div>
            <h3 class="text-center text-title text-bold mt-3">Unlink file</h3>
            <p class="text-center text-small text-secondary mt-4">
              Are you sure you want to remove this file from your file list?
            </p>
            <hr class="separator my-5" />
            <div class="flex-between-centered gap-4">
              <AppButton color="borderless" @click="isUnlinkFileModalShown = false"
                >Cancel</AppButton
              >
              <AppButton :outline="true" color="danger" @click="handleUnlinkFile">Unlink</AppButton>
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  </div>
</template>
