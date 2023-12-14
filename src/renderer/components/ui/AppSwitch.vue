<script setup lang="ts">
defineProps<{
  checked: boolean;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  disabled?: boolean;
}>();
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
    />
    <label v-if="label" class="form-check-label text-small" :for="name">
      {{ label }}
    </label>
  </div>
</template>
