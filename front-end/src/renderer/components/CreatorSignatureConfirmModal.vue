<script lang="ts" setup>
import { computed } from 'vue';
import type { CreatorSignatureStatus } from '@renderer/utils';
import { CREATOR_SIGNATURE_TEXT } from '@renderer/utils/creatorSignatureText';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';

/* Props */
const props = defineProps<{
  status: CreatorSignatureStatus;
  group?: boolean;
  callback: () => void;
}>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* Computed */
const text = computed(() => {
  if (props.status === 'verified') return '';
  const entry = CREATOR_SIGNATURE_TEXT[props.status];
  return props.group ? entry.groupConfirm : entry.confirm;
});
</script>

<template>
  <AppConfirmModal
    v-model:show="show"
    class="text-wrap"
    icon="error"
    title="Creator Signature Not Verified"
    :text="text"
    button-text="Sign Anyway"
    button-color="danger"
    data-testid="modal-confirm-sign-unverified-creator"
    :callback="props.callback"
  />
</template>
