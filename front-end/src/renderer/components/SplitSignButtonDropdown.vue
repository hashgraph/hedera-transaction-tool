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
      class="main-button"
      :disabled="props.disabled || props.loading"
      :loading="props.loading"
      :loading-text="props.loadingText"
      color="primary"
      type="submit"
    >
      {{ goNext ? 'Sign & Next' : 'Sign' }}
    </AppButton>
    <AppButton
      :disabled="props.disabled || props.loading"
      class="dropdown-toggle dropdown-toggle-split"
      color="primary"
      data-bs-toggle="dropdown"
      data-bs-offset="10,20"
    >
      <span class="visually-hidden">Toggle Dropdown</span>
    </AppButton>
    <ul class="dropdown-menu">
      <li @click="goNext = false">
        <div class="dropdown-item cursor-pointer d-flex gap-2 align-items-start">
            <i :class="['bi', 'bi-check-lg', goNext ? 'invisible' : 'visible']" />
          <div class="option-content">
            <div class="option-label">Sign</div>
            <div class="option-description">Sign this transaction</div>
          </div>
        </div>
      </li>
      <li><hr class="dropdown-divider" /></li>
      <li @click="goNext = true">
        <div class="dropdown-item cursor-pointer d-flex gap-2 align-items-start">
          <i :class="['bi', 'bi-check-lg', goNext ? 'visible' : 'invisible']" />
          <div class="option-content">
            <div class="option-label">Sign & Next</div>
            <div class="option-description">
              Sign this transaction and navigate to the next element in the list
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-divider {
  margin: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.dropdown-item {
  padding: 0.75rem 1rem 0.75rem 0.5rem;
  white-space: normal;
}

.dropdown-menu {
  min-width: 280px;
  padding: 0;
  overflow: hidden;
}

.dropdown-toggle {
  min-width: 42px;
}

.dropdown-toggle-split {
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.main-button {
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  min-width: 125px;
}

.option-label {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.option-description {
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.4;
}
</style>
