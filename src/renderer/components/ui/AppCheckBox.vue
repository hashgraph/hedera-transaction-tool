<script setup lang="ts">
defineProps<{
  checked: boolean;
  name: string;
  label?: string;
  disabled?: boolean;
}>();
defineEmits(['update:checked']);
</script>
<template>
  <div class="form-check">
    <input
      class="form-check-input"
      type="checkbox"
      :value="checked"
      @input="$emit('update:checked', !checked)"
      :name="name"
    />
    <label v-if="label" class="form-check-label text-small" :for="name">
      {{ label }}
    </label>
  </div>
</template>
