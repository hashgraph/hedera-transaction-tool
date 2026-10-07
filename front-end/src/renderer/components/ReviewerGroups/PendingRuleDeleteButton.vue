<script setup lang="ts">
import { ref } from 'vue';

import useCreateTooltip from '@renderer/composables/useCreateTooltip';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* State */
// Bootstrap tooltips can't be triggered by hovering a disabled element directly (it
// doesn't receive pointer events), so the tooltip is wired to this wrapper span instead —
// https://getbootstrap.com/docs/5.3/components/tooltips/#disabled-elements.
const wrapperRef = ref<HTMLElement | null>(null);
useCreateTooltip(wrapperRef);
</script>
<template>
  <span
    ref="wrapperRef"
    class="d-inline-block"
    tabindex="0"
    data-bs-toggle="tooltip"
    data-bs-trigger="hover"
    data-bs-placement="top"
    data-bs-title="Delete Pending"
  >
    <AppButton
      size="small"
      color="danger"
      type="button"
      class="min-w-unset"
      style="pointer-events: none"
      disabled
      ><span class="bi bi-trash"></span
    ></AppButton>
  </span>
</template>
