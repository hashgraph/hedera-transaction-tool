<script setup lang="ts">
import useUserStateStore from '../../stores/storeUserState';
import useOrganizationsStore from '../../stores/storeOrganizations';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import UserLogin from './components/UserLogin.vue';

/* Stores */
const userStateStore = useUserStateStore();
const organizationsStore = useOrganizationsStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* Handlers */
const handleOptionClick = (option: 'personal' | 'organization') => {
  userStateStore.setUserRole(option);

  switch (option) {
    case 'personal':
      userStateStore.setServerUrl('local');
      userStateStore.setUserRole('personal');
      break;
    case 'organization':
      userStateStore.setUserRole('organization');
      if (organizationsStore.organizations.length > 0) {
        try {
          organizationsStore.setCurrentOrganization(organizationsStore.organizations[0].serverUrl);
          userStateStore.setServerUrl(organizationsStore.organizations[0].serverUrl);
        } catch (err: any) {
          let message = 'Failed to set organization';
          if (err.message && typeof err.message === 'string') {
            message = err.message;
          }
          toast.error(message, { position: 'top-right' });
        }
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
    <div class="mt-8">
      <UserLogin />
    </div>
    <div
      class="mt-8 d-flex justify-content-center align-items-center text-bold cursor-pointer"
      @click="handleOptionClick(userStateStore.role === 'personal' ? 'organization' : 'personal')"
    >
      <span
        >Login as {{ userStateStore.role === 'personal' ? 'Organization' : 'Personal' }} User</span
      >
      <i class="bi bi-arrow-right-short text-headline lh-1"></i>
    </div>
  </div>
</template>
