<script setup lang="ts">
import { ref } from 'vue';

import ImportPublicKeyModal from '@renderer/components/ImportPublicKeyModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* State */
const isModalShown = ref(false);
</script>
<template>
  <AppButton
    color="primary"
    data-testid="button-restore-dropdown"
    class="min-w-unset d-flex align-items-center justify-content-center"
    @click="isModalShown = !isModalShown"
    ><i class="bi bi-plus text-main me-2"></i> Import</AppButton
  >

  <ImportPublicKeyModal class="min-w-unset" v-model:show="isModalShown" />
</template>
