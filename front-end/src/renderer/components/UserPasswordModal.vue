<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { comparePasswords } from '@renderer/services/userService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  heading?: string;
  subHeading?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'passwordEntered', password: string): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const password = ref('');

/* Handlers */
const handlePasswordEntered = async (e: Event) => {
  e.preventDefault();

  const isPasswordCorrect = await comparePasswords(user.data.id, password.value);

  if (isPasswordCorrect) {
    emit('passwordEntered', password.value);
    emit('update:show', false);
  } else {
    throw new Error('Incorrect Personal User Password');
  }
};

/* Watchers */
watch(
  () => props.show,
  () => {
    password.value = '';
  },
);
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
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
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
          <AppInput v-model="password" size="small" type="password" :filled="true" />
        </div>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton color="primary" :disabled="password.length === 0" type="submit"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
