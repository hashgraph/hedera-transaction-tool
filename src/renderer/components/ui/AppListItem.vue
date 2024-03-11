<script setup lang="ts">
defineProps<{
  selected?: boolean;
  value?: string;
}>();
</script>
<template>
  <div
    class="list-item text-small cursor-pointer overflow-hidden"
    :selected="selected ? selected : undefined"
    :value="value"
  >
    <slot></slot>
  </div>
</template>
