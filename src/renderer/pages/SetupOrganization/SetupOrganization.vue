<script setup lang="ts">
import { ref } from 'vue';

import useOrganizationsStore from '../../stores/storeOrganizations';
import useUserStateStore from '../../stores/storeUserState';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';

const organizationsStore = useOrganizationsStore();
const userStateStore = useUserStateStore();

const isSuccessModalShown = ref(false);

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

    isSuccessModalShown.value = true;
  } catch (error) {
    console.log(error);
    // Open toast
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
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i
            class="bi bi-check-circle-fill extra-large-icon cursor-pointer"
            style="line-height: 16px"
          ></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Organizations Added</h3>
        <p class="text-center text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="$router.push({ name: 'welcome' })"
          >Done</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
