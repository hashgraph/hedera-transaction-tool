<script setup lang="ts">
import AppButtonPercentage from './AppButtonPercentage.vue';

/* Props */
withDefaults(
  defineProps<{
    sliderValue: string;
    handleButtonClick: (value: string) => void;
    updateValueOn?: 'change' | 'input';
  }>(),
  {
    updateValueOn: 'input',
  },
);

/* Emits */
const emit = defineEmits(['update:sliderValue']);

/* Handlers */
const handleSliderChange = (e: Event) =>
  emit('update:sliderValue', Number((e.target as HTMLInputElement)?.value));

/* Misc */
const buttonValues = ['25', '50', '75', '100'];
</script>
<template>
  <div class="container-input-token is-readonly mb-4">
    <p class="text-micro">Amount</p>

    <div class="d-flex justify-content-between align-items-start">
      <span class="text-title text-numeric">{{ sliderValue }}%</span>

      <div class="d-flex mt-2">
        <template v-for="(buttonValue, index) in buttonValues" :key="index">
          <AppButtonPercentage
            :class="[index !== 0 ? 'ms-3' : '']"
            @click="handleButtonClick(buttonValue)"
            :percentage-amount="buttonValue"
            :is-selected="sliderValue === buttonValue"
          />
        </template>
      </div>
    </div>

    <div class="mt-3">
      <input
        :value="sliderValue"
        @[updateValueOn]="handleSliderChange"
        type="range"
        min="0"
        max="100"
        class="form-range"
      />
    </div>
  </div>
</template>
