<script setup lang="ts">
import { useRouter } from 'vue-router';

import AppButton from '../../components/ui/AppButton.vue';

import useUserStateStore from '../../stores/storeUserState';
import useOrganizationsStore from '../../stores/storeOrganizations';

const router = useRouter();
const userStateStore = useUserStateStore();
const organizationsStore = useOrganizationsStore();

const handleOptionClick = (option: 'personal' | 'organization') => {
  userStateStore.setUserRole(option);

  switch (option) {
    case 'personal':
      userStateStore.setServerUrl('local');
      router.push({ name: 'login' });
      break;
    case 'organization':
      if (organizationsStore.organizations.length > 0) {
        organizationsStore.setCurrentOrganization(organizationsStore.organizations[0].serverUrl);
        userStateStore.setServerUrl(organizationsStore.organizations[0].serverUrl);
        router.push({ name: 'login' });
      } else {
        router.push({ name: 'setupOrganization' });
      }
      break;
    default:
      break;
  }
};
</script>
<template>
  <div
    class="p-10 d-flex flex-column justify-content-center align-items-center flex-1 overflow-hidden"
  >
    <h1 class="text-huge text-bold">Welcome to TRX Tool</h1>
    <p class="mt-4 text-main text-normal">Please Setup Organizaton to continue</p>
    <div class="mt-8 d-flex gap-4">
      <div
        class="container-welcome-card container-modal-card p-5 border border-dark-subtle rounded-4"
      >
        <i class="bi bi-person mt-5 extra-large-icon d-block text-body-tertiary"></i>
        <h4 class="mt-4 text-main text-bold text-center">Login as Personal User</h4>
        <p class="text-secondary text-small lh-base text-center">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="handleOptionClick('personal')"
          >Login as Personal User</AppButton
        >
      </div>
      <div
        class="container-welcome-card container-modal-card p-5 border border-dark-subtle rounded-4"
      >
        <i class="bi bi-briefcase mt-5 extra-large-icon text-body-tertiary"></i>
        <h4 class="mt-4 text-main text-bold text-center">Login as Organizaton</h4>
        <p class="text-small text-secondary lh-base text-center">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="handleOptionClick('organization')"
          >Login as Organizaton</AppButton
        >
      </div>
    </div>
  </div>
</template>
