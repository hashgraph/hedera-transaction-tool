<script setup lang="ts">
import { computed, ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { type ITransactionNode } from '../../../../../../middle-end/src/ITransactionNode.ts';

/* Props */
const props = defineProps<{
  node: ITransactionNode;
  index: number;
}>();

/* State */
const signOnGoing = ref(false);

/* Computed */
const buttonTitle = computed(() => {
  return props.node.transactionId ? 'Sign' : 'Sign All';
});

/* Handlers */
const handleClick = async () => {};
</script>

<template>
  <AppButton
    :data-testid="`button-group-sign-${props.index}`"
    :disabled="signOnGoing"
    :loading="signOnGoing"
    :loading-text="buttonTitle"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    {{ buttonTitle }}
  </AppButton>
</template>
