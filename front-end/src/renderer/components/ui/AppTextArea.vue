<script setup lang="ts">
import { computed, ref } from 'vue';
import useCreateTooltip from '@renderer/composables/useCreateTooltip.ts';

/* Props */
const props = defineProps<{
  modelValue?: string | number;
  filled?: boolean;
  limit?: number;
}>();

defineEmits(['update:modelValue']);

/* State */
const inputRef = ref<HTMLInputElement | null>(null);
useCreateTooltip(inputRef);

/* Computed */
const fillClass = computed(() => (props.filled ? 'is-fill' : ''));

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <textarea
    ref="inputRef"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target! as HTMLInputElement).value)"
    :class="['form-control', fillClass]"
    rows="4"
    v-bind:maxlength="limit || undefined"
  />
</template>
