<script setup lang="ts">
import type { ComplexKey } from '@prisma/client';

import { ref } from 'vue';

import { KeyList } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { addComplexKey } from '@renderer/services/complexKeysService';

import { encodeKey, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import useNicknamesStore from '@renderer/stores/storeNicknames';

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
const nicknames = useNicknamesStore();

/* Composables */
const toast = useToast();

/* State */
const nickname = ref('');

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleSaveKeyList = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const newKey = await nicknames.saveTopLevelNickname(props.keyList, nickname.value);

  toast.success('Key list saved successfully');

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
      <form class="mt-3" @submit.prevent="handleSaveKeyList">
        <h3 class="text-center text-title text-bold">Enter the nickname</h3>
        <div class="form-group mt-5 mb-4">
          <label class="form-label">Nickname</label>
          <AppInput
            v-model:model-value="nickname"
            :filled="true"
            placeholder="Enter name of complex key"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton type="button" color="borderless" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton type="submit" color="primary" :disabled="nickname.length === 0"
            >Save</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
