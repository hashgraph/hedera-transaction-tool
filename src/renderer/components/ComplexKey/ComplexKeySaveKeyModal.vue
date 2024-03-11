<script setup lang="ts">
import { ref } from 'vue';

import { KeyList } from '@hashgraph/sdk';
import { ComplexKey } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { addComplexKey } from '@renderer/services/complexKeysService';

import { encodeKeyList } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  keyList: KeyList;
  onComplexKeySave: (complexKey: ComplexKey) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const nickname = ref('');

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleSaveKeyList = async e => {
  e.preventDefault();

  const keyListBytes = encodeKeyList(props.keyList);
  const newKey = await addComplexKey(user.data.id, keyListBytes, nickname.value);

  toast.success('Key list saved successfully', { position: 'bottom-right' });

  props.onComplexKeySave(newKey);
};
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleShowUpdate"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleShowUpdate(false)"></i>
      </div>
      <form class="mt-3" @submit="handleSaveKeyList">
        <h3 class="text-center text-title text-bold">Enter your password</h3>
        <div class="form-group mt-5 mb-4">
          <label class="form-label">Nickname</label>
          <AppInput
            v-model:model-value="nickname"
            :filled="true"
            placeholder="Enter Name of Key List"
          />
        </div>
        <hr class="separator" />
        <div class="row mt-4">
          <div class="col-6 d-grid">
            <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
              >Cancel</AppButton
            >
          </div>
          <div class="col-6 d-grid">
            <AppButton type="submit" color="primary" :disabled="nickname.length === 0"
              >Save</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
