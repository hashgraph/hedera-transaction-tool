<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { CreatorSignatureStatus } from '@renderer/utils';
import { CREATOR_SIGNATURE_TEXT } from '@renderer/utils/creatorSignatureText';
import useCreateTooltip from '@renderer/composables/useCreateTooltip';

/* Props */
const props = defineProps<{
  status: CreatorSignatureStatus;
  group?: boolean;
}>();

/* Composables */
const pillRef = ref<HTMLElement | null>(null);
useCreateTooltip(pillRef);

/* Computed */
const text = computed(() =>
  props.status === 'verified' ? null : CREATOR_SIGNATURE_TEXT[props.status],
);
</script>

<template>
  <span
    v-if="text"
    ref="pillRef"
    class="badge"
    :class="props.status === 'data-missing' ? 'bg-danger' : 'bg-warning'"
    data-bs-toggle="tooltip"
    data-bs-trigger="hover"
    data-bs-placement="top"
    data-bs-custom-class="wide-tooltip"
    :data-bs-title="props.group ? text.groupMessage : text.message"
    >{{ text.label }}</span
  >
</template>
