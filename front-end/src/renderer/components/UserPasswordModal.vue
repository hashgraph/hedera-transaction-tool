<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { comparePasswords } from '@renderer/services/userService';

import { isLoggedInWithPassword, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

/* Stores */
const user = useUserStore();

/* State */
const show = ref(false);
const heading = ref<string | null>(null);
const subHeading = ref<string | null>(null);
const password = ref('');
const callback = ref<((password: string) => void) | null>(null);

/* Handlers */
const handlePasswordEntered = async (e: Event) => {
  e.preventDefault();
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const isPasswordCorrect = await comparePasswords(user.personal.id, password.value);

  if (isPasswordCorrect) {
    user.setPassword(password.value);
    if (!isLoggedInWithPassword(user.personal)) throw new Error('Failed to set user password');

    const currentCallback = callback.value;
    handleClose();

    await currentCallback?.(user.personal.password);
  } else {
    throw new Error('Incorrect Personal User Password');
  }
};

const handleClose = () => {
  callback.value = null;
  password.value = '';
  heading.value = '';
  subHeading.value = '';
  show.value = false;
};

const handleOpen = (
  _heading: string | null,
  _subHeading: string | null,
  _callback: (password: string) => void,
) => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  user.personal.password = '';

  heading.value = _heading;
  subHeading.value = _subHeading;
  callback.value = _callback;
  show.value = true;
};

/* Exposes */
defineExpose({
  open: handleOpen,
  close: handleClose,
});
</script>
<template>
  <AppModal
    :show="show"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleClose"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'lock'" style="height: 160px" />
      </div>
      <form class="mt-3" @submit="handlePasswordEntered">
        <h3 class="text-center text-title text-bold">{{ heading || 'Enter your password' }}</h3>
        <p class="text-center text-small text-secondary mt-4" v-if="subHeading">
          {{ subHeading }}
        </p>
        <div class="form-group mt-5 mb-4">
          <label class="form-label">Password</label>
          <AppPasswordInput
            v-model="password"
            data-testid="input-encrypt-password"
            size="small"
            :filled="true"
          />
        </div>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleClose">Cancel</AppButton>
          <AppButton
            color="primary"
            data-testid="button-continue-encrypt-password"
            :disabled="password.length === 0"
            type="submit"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
