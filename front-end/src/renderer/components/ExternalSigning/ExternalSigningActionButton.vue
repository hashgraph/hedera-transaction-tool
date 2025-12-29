<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import ExternalSigningActionModal from '@renderer/components/ExternalSigning/ExternalSigningActionModal.vue';

/* State */
const isModalShow = ref(false);
</script>

<template>
  <AppButton
    v-bind="$attrs"
    color="primary"
    type="button"
    @click.prevent="isModalShow = true"
  >
    Request External Signing
  </AppButton>
  <ExternalSigningActionModal v-model:show="isModalShow" />
</template>
