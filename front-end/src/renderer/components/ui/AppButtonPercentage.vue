<script setup lang="ts">
/* Props */
const props = defineProps<{
  isSelected?: boolean;
  percentageAmount: string;
  className?: string;
}>();

/* Misc */
const buttonLabel = props.percentageAmount === '100' ? 'MAX' : `${props.percentageAmount}%`;
</script>
<template>
  <span :class="['btn-percentage', isSelected ? 'is-active' : '']"> {{ buttonLabel }} </span>
</template>
