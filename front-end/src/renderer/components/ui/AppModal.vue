<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/* Props */
const props = withDefaults(
  defineProps<{
    show: boolean;
    closeOnEscape?: boolean;
    closeOnClickOutside?: boolean;
  }>(),
  {
    closeOnEscape: true,
    closeOnClickOutside: true,
  },
);

/* Emits */
const emit = defineEmits(['update:show']);

/* State */
const modalRef = ref<HTMLDivElement | null>(null);

/* Handlers */
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closeOnEscape) {
    emit('update:show', false);
  }
};

const handleClickOutside = (event: Event) => {
  if (!modalRef.value?.contains(event.target as HTMLDivElement) && props.closeOnClickOutside) {
    emit('update:show', false);
  }
};

/* Hooks */
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>
<template>
  <div
    v-bind="$attrs"
    class="modal fade show"
    aria-labelledby="exampleModalLabel"
    aria-hidden="true"
    data-testid="modal-confirm-transaction"
    :style="{ display: show ? 'block' : 'none' }"
  >
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" ref="modalRef">
      <div class="modal-content">
        <div class="modal-body"><slot></slot></div>
      </div>
    </div>
  </div>
  <div :style="{ display: show ? 'block' : 'none' }" class="modal-backdrop fade show"></div>
</template>
