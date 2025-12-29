<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import CreateExternalSigningResponseModal from './ReviewExternalSigningResponseModal.vue';

/* Emits */
const emit = defineEmits<{
  (event: 'clicked'): void;
}>();

/* State */
const isModalShow = ref(false);

/* Handlers */
const handleClick = () => {
  isModalShow.value = true;
  emit('clicked');
};
</script>

<template>
  <AppButton v-bind="$attrs" color="primary" type="button" @click.prevent="handleClick">
    Review External Signing Response
  </AppButton>
  <CreateExternalSigningResponseModal v-model:show="isModalShow" />
</template>
