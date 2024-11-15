<script setup lang="ts">
import type { ComplexKey } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { deleteComplexKey, getComplexKeys } from '@renderer/services/complexKeysService';

import { decodeKeyList, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  onKeyListSelect: (complexKey: ComplexKey) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* State */
const keyLists = ref<ComplexKey[]>([]);
const complexKeyId = ref<string | null>(null);
const search = ref('');
const deleteSavedKeyModalShown = ref(false);
const complexKeyToDeleteId = ref<string | null>(null);

/* Computed */
const complexKey = computed(() => keyLists.value.find(kl => kl.id === complexKeyId.value) || null);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleSelectKeyList = (id: string) => {
  complexKeyId.value = id;
};

const handleTrashClick = (e: Event, id: string) => {
  e.stopPropagation();
  complexKeyToDeleteId.value = id;
  deleteSavedKeyModalShown.value = true;
};

const handleDeleteSavedKey = async (e: Event) => {
  e.preventDefault();

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }
  if (complexKeyToDeleteId.value) {
    await deleteComplexKey(complexKeyToDeleteId.value);
    keyLists.value = await getComplexKeys(user.personal.id);
  }

  deleteSavedKeyModalShown.value = false;
  complexKeyId.value = null;
};

const handleDone = (e: Event) => {
  e.preventDefault();

  if (complexKey.value) {
    props.onKeyListSelect(complexKey.value);
    handleShowUpdate(false);
  }
};

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  keyLists.value = await getComplexKeys(user.personal.id);
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleDone">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Saved Complex Keys</h1>
        <div class="mt-5">
          <AppInput
            :model-value="complexKey?.nickname"
            filled
            readonly
            type="text"
            placeholder="Search Complex Key"
          />
        </div>
        <hr class="separator my-5" />
        <div>
          <div class="overflow-auto" :style="{ height: '20vh', paddingRight: '10px' }">
            <template
              v-for="kl in keyLists.filter(
                kl =>
                  kl.nickname.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
                  decodeKeyList(kl.protobufEncoded).toArray().length.toString().includes(search) ||
                  decodeKeyList(kl.protobufEncoded).threshold ||
                  '' == search,
              )"
              :key="kl.id"
            >
              <AppListItem
                :value="kl.id"
                @click="handleSelectKeyList(kl.id)"
                :selected="kl.id === complexKeyId"
                class="mt-3"
              >
                <div
                  class="d-flex justify-content-between align-items-center flex-nowrap text-nowrap"
                >
                  <div class="d-flex align-items-center w-100">
                    <span class="text-semi-bold text-truncate" style="max-width: 35%">
                      {{ kl.nickname }}
                    </span>
                    <p
                      class="text-body bg-dark-blue-800 flex-centered rounded ms-3"
                      style="width: 36px; height: 36px"
                    >
                      {{
                        decodeKeyList(kl.protobufEncoded).threshold ||
                        decodeKeyList(kl.protobufEncoded).toArray().length
                      }}
                    </p>
                    <p class="text-secondary ms-3">
                      of {{ decodeKeyList(kl.protobufEncoded).toArray().length }}
                    </p>
                    <p class="text-secondary border-start border-secondary-subtle ps-4 ms-4">
                      {{ kl.updated_at.toDateString() }}
                    </p>
                    <div class="flex-1 text-end ms-3">
                      <span
                        class="bi bi-trash text-danger cursor-pointer"
                        @click="handleTrashClick($event, kl.id)"
                      ></span>
                    </div>
                  </div>
                </div>
              </AppListItem>
            </template>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton color="primary" type="submit" :disabled="!complexKey">Done</AppButton>
        </div>
      </form>
      <AppModal v-model:show="deleteSavedKeyModalShown" class="common-modal">
        <div class="p-4">
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="deleteSavedKeyModalShown = false"
          ></i>
          <div class="text-center">
            <AppCustomIcon :name="'bin'" style="height: 160px" />
          </div>
          <form @submit="handleDeleteSavedKey">
            <h3 class="text-center text-title text-bold mt-3">Remove Key List</h3>
            <p class="text-center text-small text-secondary mt-4">
              Are you sure you want to remove this Key List from your Complex Keys List
            </p>
            <hr class="separator my-5" />
            <div class="flex-between-centered gap-4">
              <AppButton type="button" color="borderless" @click="deleteSavedKeyModalShown = false"
                >Cancel</AppButton
              >
              <AppButton color="danger" type="submit">Remove</AppButton>
            </div>
          </form>
        </div>
      </AppModal>
    </div>
  </AppModal>
</template>
