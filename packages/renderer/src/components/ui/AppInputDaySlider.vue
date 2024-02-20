<script setup lang="ts">
/* Props */
withDefaults(
  defineProps<{
    sliderValue: number;
    maxValue: number;
    minValue: number;
    updateValueOn?: 'change' | 'input';
  }>(),
  {
    updateValueOn: 'input',
  },
);

/* Emits */
defineEmits(['update:sliderValue']);
</script>
<template>
  <div class="container-input-token is-readonly mb-4">
    <p class="text-micro">Days</p>

    <div class="d-flex justify-content-between align-items-start">
      <span class="text-title text-numeric">{{ sliderValue }}</span>
    </div>

    <div class="mt-3">
      <input
        :value="sliderValue"
        type="range"
        :min="minValue"
        :max="maxValue"
        class="form-range"
        @[updateValueOn]="
          $emit('update:sliderValue', Number(($event.target as HTMLInputElement)?.value))
        "
      />
    </div>
  </div>
</template>
