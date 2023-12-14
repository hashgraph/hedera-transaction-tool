<script setup lang="ts">
import AppButton from '../../../components/ui/AppButton.vue';
</script>
<template>
  <div class="mt-8 d-flex flex-column justify-content-center align-items-center">
    <AppButton color="primary" @click="$router.push({ name: 'settingsKeys' })">Finish</AppButton>
  </div>
</template>
