<script setup lang="ts">
/* Props */
defineProps<{
  name: string;
  checked?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  labelClass?: string;
}>();

/* Emits */
defineEmits(['update:checked']);
</script>
<template>
  <div
    class="form-check form-switch d-flex align-items-center gap-3"
    :class="[size && `form-switch-${size}`]"
  >
    <input
      class="form-check-input"
      type="checkbox"
      role="switch"
      :checked="checked"
      @input="$emit('update:checked', !checked)"
      :name="name"
      v-bind="$attrs"
    />
    <label v-if="label" class="form-check-label" :class="labelClass" :for="name">
      {{ label }}
    </label>
  </div>
</template>
