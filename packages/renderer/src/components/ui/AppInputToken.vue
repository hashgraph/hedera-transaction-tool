<script setup lang="ts">
/* Props */
defineProps<{
  isCompact?: boolean;
  placeholder?: string;
}>();
</script>
<template>
  <input
    autocomplete="off"
    :placeholder="placeholder || '0.0'"
    :class="['input-token', isCompact ? 'is-compact' : '']"
    type="text"
  />
</template>
