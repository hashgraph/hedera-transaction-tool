<script setup lang="ts">
/* Props */
defineProps<{
  isInvalid?: boolean;
  readonly?: boolean;
}>();
</script>
<template>
  <div
    :class="['container-input-token', isInvalid ? 'is-invalid' : '', readonly ? 'is-readonly' : '']"
  >
    <div className="d-flex justify-content-between align-items-center">
      <slot name="inputToken"></slot>
      <slot name="buttonSelector"></slot>
    </div>

    <div className="d-flex justify-content-end mt-3"><slot name="walletBalance"></slot></div>
  </div>
</template>
