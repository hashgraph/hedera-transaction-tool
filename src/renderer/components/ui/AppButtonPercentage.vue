<script setup lang="ts">
const props = defineProps<{
  isSelected?: boolean;
  percentageAmount: string;
  className?: string;
}>();

const buttonLabel = props.percentageAmount === '100' ? 'MAX' : `${props.percentageAmount}%`;
</script>
<template>
  <span :class="['btn-percentage', isSelected ? 'is-active' : '']"> {{ buttonLabel }} </span>
</template>
