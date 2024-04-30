<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { isEmail } from '@renderer/utils';
import { signUp } from '@renderer/services/organization';
import { addContact } from '@renderer/services/contactsService';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();

/* State */
const email = ref('');
const nickname = ref('');

const handleLinkAccount = async e => {
  e.preventDefault();

  if (!isEmail(email.value)) throw new Error('Invalid email');
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('Please select organization');
  if (!user.selectedOrganization.admin) throw new Error('Only admin can register users');

  const { id } = await signUp(user.selectedOrganization.serverUrl, email.value);

  toast.success('User signed up successfully');

  if (nickname.value.trim().length > 0) {
    await addContact({
      user_id: user.personal.id,
      organization_id: user.selectedOrganization.id,
      organization_user_id: id,
      organization_user_id_owner: user.selectedOrganization.userId,
      nickname: nickname.value,
    });
  }

  router.back();
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  () => {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      router.push({ name: 'transactions' });
    }
  },
);
</script>
<template>
  <div class="p-5">
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="$router.back()">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Link existing account</h2>
    </div>
    <form class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4" @submit="handleLinkAccount">
      <div class="form-group">
        <label class="form-label">Email <span class="text-danger">*</span></label>
        <AppInput v-model="email" :filled="true" placeholder="Enter email" />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
      </div>
      <AppButton color="primary" type="submit" class="mt-5">Register User</AppButton>
    </form>
  </div>
</template>
