<script setup lang="ts">
/* Props */
defineProps<{
  checked: boolean;
  name: string;
  label?: string;
  disabled?: boolean;
  dataTestid?: string;
}>();

/* Emits */
defineEmits(['update:checked']);
</script>
<template>
  <div class="form-check">
    <input
      class="form-check-input"
      type="checkbox"
      :checked="checked"
      @input="$emit('update:checked', !checked)"
      :name="name"
      :id="name"
      :data-testid="dataTestid"
      v-bind="$attrs"
      :disabled="disabled"
    />
    <label v-if="label" class="form-check-label text-small cursor-pointer" :for="name">
      {{ label }}
    </label>
  </div>
</template>
