<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { signUp } from '@renderer/services/organization';
import { addContact } from '@renderer/services/contactsService';

import {
  isLoggedInOrganization,
  isUserLoggedIn,
  isEmail,
  assertUserLoggedIn,
  assertIsLoggedInOrganization,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const email = ref('');
const nickname = ref('');
const multipleEmails = ref('');
const isMultipleMode = ref(false);

/* Handlers */
const handleLinkAccount = async () => {
  if (isMultipleMode.value) {
    const [validEmails, invalidEmails] = multipleEmails.value
      .split(',')
      .map(e => e.trim())
      .reduce(
        ([valid, invalid], email) => {
          isEmail(email) ? valid.push(email) : invalid.push(email);
          return [valid, invalid];
        },
        [[], []] as [string[], string[]],
      );

    if (invalidEmails.length > 0) throw new Error(`Invalid emails: ${invalidEmails.join(', ')}`);

    const failedEmails: string[] = [];
    for (const email of validEmails) {
      if (!isEmail(email)) throw new Error('Invalid email');
      try {
        await signUpUser(email);
      } catch (error) {
        console.error(error);
        failedEmails.push(email);
      }
    }

    if (failedEmails.length > 0) {
      toast.error(`Failed to sign up users with emails: ${failedEmails.join(', ')}`);
    } else {
      toast.success('All users signed up successfully');
    }
  } else {
    if (!isEmail(email.value)) throw new Error('Invalid email');
    try {
      assertUserLoggedIn(user.personal);
      assertIsLoggedInOrganization(user.selectedOrganization);

      const id = await signUpUser(email.value);

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
    } catch (error) {
      console.error(error);
      toast.error('Failed to sign up user');
    }
  }
  router.back();
};

const signUpUser = async (email: string) => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('Please select organization');
  if (!user.selectedOrganization.admin) throw new Error('Only admin can register users');

  const { id } = await signUp(user.selectedOrganization.serverUrl, email);

  return id;
};

/* Computed */
const buttonText = computed(() => (isMultipleMode.value ? 'Register Users' : 'Register User'));

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

      <h2 class="text-title text-bold">Create New Organization User</h2>
    </div>
    <form class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4" @submit.prevent="handleLinkAccount">
      <div class="d-flex justify-content-between align-items-start">
        <label class="form-label">Email <span class="text-danger">*</span></label>
        <div class="d-flex align-items-center justify-content-end">
          <label class="form-check-label me-3" for="multipleModeSwitch">
            {{ isMultipleMode ? 'Multiple Emails' : 'Single Email' }}
          </label>
          <div class="form-check form-switch mb-n3">
            <input
              class="form-check-input"
              type="checkbox"
              id="multipleModeSwitch"
              v-model="isMultipleMode"
            />
          </div>
        </div>
      </div>
      <div v-if="!isMultipleMode" class="form-group">
        <AppInput
          v-model="email"
          data-testid="input-new-user-email"
          :filled="true"
          placeholder="Enter email"
        />
      </div>
      <div v-if="!isMultipleMode" class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
      </div>
      <div v-if="isMultipleMode" class="form-group">
        <AppTextArea
          v-model="multipleEmails"
          data-testid="textarea-multiple-emails"
          :filled="true"
          placeholder="Enter emails separated by commas"
        />
      </div>
      <AppButton color="primary" data-testid="button-register-user" type="submit" class="mt-5">
        {{ buttonText }}
      </AppButton>
    </form>
  </div>
</template>
