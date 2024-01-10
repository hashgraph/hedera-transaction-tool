<script setup lang="ts">
type Props = {
  isCompact?: boolean;
  placeholder?: string;
};

defineProps<Props>();
</script>
<template>
  <input
    autocomplete="off"
    :placeholder="placeholder || '0.0'"
    :class="['input-token', isCompact ? 'is-compact' : '']"
    type="text"
  />
</template>
