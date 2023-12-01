<script setup lang="ts">
import AppButton from '../../components/ui/AppButton.vue';
</script>
<template>
  <div
    class="p-10 d-flex flex-column justify-content-center align-items-center flex-1 overflow-hidden"
  >
    <h1 class="text-huge text-bold">Welcome to TRX Tool</h1>
    <h3 class="mt-4 text-main text-normal">Please Setup Organizaton to continue</h3>
    <div class="mt-8 d-flex gap-4">
      <div class="container-welcome-card p-5 border border-dark-subtle rounded-4">
        <i class="bi bi-person mt-5 d-block text-body-tertiary"></i>
        <h4 class="mt-4 text-main text-bold text-center">Login as Personal User</h4>
        <p class="subtext text-main lh-base text-center">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4"
          >Login as Personal User</AppButton
        >
      </div>
      <div class="container-welcome-card p-5 border border-dark-subtle rounded-4">
        <div class="person-icon mt-5 w-100 position-relative">
          <i class="bi bi-person position-absolute top-0 text-body-tertiary"></i>
          <i class="bi bi-person position-absolute text-body-tertiary"></i>
        </div>
        <h4 class="mt-4 text-main text-bold text-center">Login as Organizaton</h4>
        <p class="subtext text-main lh-base text-center">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4"
          >Login as Organizaton</AppButton
        >
      </div>
    </div>
  </div>
</template>
<style></style>
