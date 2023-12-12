<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import AppButton from '../../components/ui/AppButton.vue';
import useOrganizationsStore from '../../stores/storeOrganizations';
import useUserStateStore from '../../stores/storeUserState';

const router = useRouter();
const organizationsStore = useOrganizationsStore();
const userStateStore = useUserStateStore();

const organizationName = ref('');
const serverUrl = ref('');
const serverPublicKey = ref('');

const handleContinue = async (e: Event) => {
  e.preventDefault();

  //ADD FORM VALIDATION

  try {
    await organizationsStore.addOrganization({
      name: organizationName.value,
      serverUrl: serverUrl.value,
      serverPublicKey: serverPublicKey.value,
    });

    userStateStore.setUserRole('organization');
  } catch (error) {
    console.log(error);
    // Open toast
  }

  router.push({ name: 'welcome' });
};
</script>
<template>
  <div
    class="p-10 d-flex flex-column justify-content-center align-items-center flex-1 overflow-hidden"
  >
    <h1 class="text-huge text-bold text-center">Setup Organization</h1>
    <form
      @submit="handleContinue"
      class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
    >
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <input
          v-model="organizationName"
          type="text"
          class="form-control rounded-4"
          placeholder="Enter name of Organization"
        />
        <input
          v-model="serverUrl"
          type="text"
          class="mt-4 form-control rounded-4"
          placeholder="Enter Organization Server URL"
        />
        <input
          v-model="serverPublicKey"
          type="text"
          class="mt-4 form-control rounded-4"
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
          class="w-100 rounded-4"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
