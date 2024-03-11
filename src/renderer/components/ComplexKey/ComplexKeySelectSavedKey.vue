<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { ComplexKey } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { deleteComplexKey, getComplexKeys } from '@renderer/services/complexKeysService';

import { decodeKeyList } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
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
const complexKey = ref<ComplexKey | null>(null);
const search = ref('');
const deleteSavedKeyModalShown = ref(false);
const complexKeyToDeleteId = ref<string | null>(null);

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleSelectKeyList = (kl: ComplexKey) => {
  complexKey.value = kl;
};

const handleTrashClick = (e, id: string) => {
  e.stopPropagation();
  complexKeyToDeleteId.value = id;
  deleteSavedKeyModalShown.value = true;
};

const handleDeleteSavedKey = async e => {
  e.preventDefault();

  if (complexKeyToDeleteId.value) {
    await deleteComplexKey(complexKeyToDeleteId.value);
    keyLists.value = await getComplexKeys(user.data.id);
  }

  deleteSavedKeyModalShown.value = false;
  complexKey.value = null;
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
  keyLists.value = await getComplexKeys(user.data.id);
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleDone">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-center">Saved Complex Keys</h1>
        <div class="mt-5">
          <AppInput
            v-model:model-value="search"
            filled
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
              <div
                class="key-node d-flex justify-content-between key-threshhold-bg text-white rounded py-4 px-3 mt-3"
                @click="handleSelectKeyList(kl)"
              >
                <div class="col-11 d-flex align-items-center text-small">
                  <div class="text-semi-bold text-truncate" style="max-width: 35%">
                    {{ kl.nickname }}
                  </div>

                  <div class="d-flex align-items-center ms-4">
                    <p
                      class="text-body bg-dark-blue-700 flex-centered rounded ms-3"
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
                  </div>
                </div>
                <div class="col-1 flex-centered">
                  <span
                    class="bi bi-trash text-danger cursor-pointer"
                    @click="handleTrashClick($event, kl.id)"
                  ></span>
                </div>
              </div>
            </template>
          </div>
        </div>
        <hr class="separator my-5" />
        <div class="row justify-content-between">
          <div class="col-4 d-grid">
            <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
              >Cancel</AppButton
            >
          </div>
          <div class="col-4 d-grid">
            <AppButton color="primary" type="submit" :disabled="!complexKey">Done</AppButton>
          </div>
        </div>
      </form>
      <AppModal v-model:show="deleteSavedKeyModalShown" class="common-modal">
        <div class="modal-body">
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
            <div class="row mt-4">
              <div class="col-6 d-grid">
                <AppButton color="secondary" @click="deleteSavedKeyModalShown = false"
                  >Cancel</AppButton
                >
              </div>
              <div class="col-6 d-grid">
                <AppButton
                  :outline="true"
                  color="primary"
                  type="submit"
                  @click="handleDeleteSavedKey"
                  >Remove</AppButton
                >
              </div>
            </div>
          </form>
        </div>
      </AppModal>
    </div>
  </AppModal>
</template>
