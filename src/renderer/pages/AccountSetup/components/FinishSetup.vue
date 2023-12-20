<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';

const isSuccessModalShown = ref(false);
</script>
<template>
  <div class="mt-8 d-flex flex-column align-items-center">
    <p>
      You are about to finish the Account Setup. Keep in mind you can access your Key Pair in
      Settings.
    </p>
    <div class="mt-8 w-100 d-flex justify-content-center row">
      <AppButton
        size="large"
        color="primary"
        class="rounded-4 col-6"
        @click="isSuccessModalShown = true"
        >Finish</AppButton
      >
    </div>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-circle-fill extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Account Setup Successfull</h3>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="$router.push({ name: 'settingsKeys' })"
          >Continue</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
