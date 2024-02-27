<script setup lang="ts">
import {ref} from 'vue';

import useOrganizationsStore from '@renderer/stores/storeOrganizations';
import useUserStore from '@renderer/stores/storeUser';

import {useToast} from 'vue-toast-notification';
import {useRouter} from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const organizationsStore = useOrganizationsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const organizationName = ref('');
const serverUrl = ref('');
const serverPublicKey = ref('');

/* Handlers */
const handleContinue = async (e: Event) => {
  e.preventDefault();

  try {
    await organizationsStore.addOrganization({
      name: organizationName.value,
      serverUrl: serverUrl.value,
      serverPublicKey: serverPublicKey.value,
    });

    user.data.mode = 'organization';
    user.data.activeServerURL = serverUrl.value;

    toast.error('Organizations Added', {position: 'bottom-right'});
    router.push({name: 'welcome'});
  } catch (err: any) {
    let message = 'Failed to add organization';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, {position: 'bottom-right'});
  }
};
</script>
<template>
  <div
    class="p-10 d-flex flex-column justify-content-center align-items-center flex-1 overflow-hidden"
  >
    <h1 class="text-huge text-bold text-center">Setup Organization</h1>
    <p class="mt-5">Please Enter Organisation details</p>
    <form
      @submit="handleContinue"
      class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
    >
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppInput
          v-model="organizationName"
          :filled="true"
          placeholder="Enter name of Organization"
        />
        <AppInput
          v-model="serverUrl"
          :filled="true"
          class="mt-4"
          placeholder="Enter Organization Server URL"
        />
        <AppInput
          v-model="serverPublicKey"
          :filled="true"
          class="mt-4"
          placeholder="Enter Organization Server Public key"
        />
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          type="submit"
          :disabled="
            organizationName.length === 0 || serverUrl.length === 0 || serverPublicKey.length === 0
          "
          color="primary"
          size="large"
          class="w-100"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
