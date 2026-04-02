<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SignAllController from '@renderer/pages/TransactionGroupDetails/SignAllController.vue';

/* Props */
const props = defineProps<{
  groupId: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionGroupSigned', payload: { groupId: number; signed: boolean }): void;
}>();

/* State */
const signAllStarted = ref<boolean>(false);

/* Handlers */
const handleClick = () => {
  signAllStarted.value = true;
};

const didSignAll = async (groupId: number , signed: boolean) => {
  emit('transactionGroupSigned', { groupId, signed });
};
</script>

<template>
  <AppButton
    v-bind="$attrs"
    loading-text="Sign All"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    Sign All
  </AppButton>

  <SignAllController
    v-model:activate="signAllStarted"
    :groupOrId="props.groupId"
    :callback="didSignAll"
  />
</template>
