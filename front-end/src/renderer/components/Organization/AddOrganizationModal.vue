<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { watch, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { addOrganization } from '@renderer/services/organizationsService';
import { healthCheck } from '@renderer/services/organization';

import { getErrorMessage } from '@renderer/utils';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import useVersionCheck from '@renderer/composables/useVersionCheck';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'added', organization: Organization): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const { isDismissed } =
  useVersionCheck();

/* State */
const nickname = ref('');
const serverUrl = ref('');
const newOrgNickname = ref<string>('');

/* Handlers */
const handleAdd = async () => {
  try {
    const url = new URL(serverUrl.value);
    serverUrl.value = url.origin;
  } catch {
    throw new Error('Invalid Server URL');
  }
  try {
    const active = await healthCheck(serverUrl.value);

    if (!active) {
      throw new Error('Organization does not exist. Please check the server URL');
    }

    // Suppress the version check warning for adding organizations
    isDismissed.value = true;

    const organization = await addOrganization({
      nickname: nickname.value.trim() || `Organization ${user.organizations.length + 1}`,
      serverUrl: serverUrl.value,
      key: '',
    });

    newOrgNickname.value = organization.nickname || serverUrl.value;

    toast.success('Organization Added', successToastOptions);
    emit('added', organization);
    emit('update:show', false);
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to add organization'), errorToastOptions);
  }
};

/* Watchers */
watch(
  () => props.show,
  () => {
    nickname.value = '';
    serverUrl.value = '';
    newOrgNickname.value = '';
  },
);
</script>

<template>
  <AppModal
    :show="show"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <form class="p-4" @submit.prevent="handleAdd">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'group'" style="height: 160px" />
      </div>
      <h2 class="text-center text-title text-semi-bold mt-3">Setup Organization</h2>
      <p class="text-center text-small text-secondary mt-3">
        Please Enter Organization Nickname and Server URL
      </p>

      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput
          size="small"
          data-testid="input-organization-nickname"
          v-model="nickname"
          :filled="true"
          placeholder="Enter nickname"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Server URL</label>
        <AppInput
          size="small"
          data-testid="input-server-url"
          v-model="serverUrl"
          :filled="true"
          placeholder="Enter Server URL"
        />
      </div>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          data-testid="button-cancel-adding-org"
          color="borderless"
          type="button"
          @click="$emit('update:show', false)"
          >Cancel</AppButton
        >
        <AppButton color="primary" data-testid="button-add-organization-in-modal" type="submit"
          >Add</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
