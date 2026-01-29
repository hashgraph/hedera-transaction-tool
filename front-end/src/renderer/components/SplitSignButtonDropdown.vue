<script lang="ts" setup>
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';

/* Props */
const props = defineProps<{
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
}>();

/* State */
const goNext = ref(false);
</script>
<template>
  <div class="btn-group">
    <AppButton
      :disabled="props.disabled || props.loading"
      :loading="props.loading"
      :loading-text="props.loadingText"
      color="primary"
      style="min-width: 125px"
      type="submit"
    >
      {{ goNext ? 'Sign & Next' : 'Sign' }}
    </AppButton>
    <AppButton
      :disabled="props.disabled || props.loading"
      class="dropdown-toggle dropdown-toggle-split"
      color="primary"
      data-bs-toggle="dropdown"
      style="min-width: 42px"
    >
      <span class="visually-hidden">Toggle Dropdown</span>
    </AppButton>
    <ul class="dropdown-menu">
      <li @click="goNext = false">
        <div class="dropdown-item cursor-pointer">Sign</div>
      </li>
      <li><hr class="dropdown-divider" /></li>
      <li @click="goNext = true">
        <div class="dropdown-item cursor-pointer">Sign & Next</div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-toggle-split {
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
