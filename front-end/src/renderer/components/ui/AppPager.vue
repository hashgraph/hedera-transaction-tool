<script setup lang="ts">
import { computed, ref, watch } from 'vue';

/* Props */
const props = withDefaults(
  defineProps<{
    currentPage: number;
    totalItems: number;
    perPage?: number;
    maxPagesInNav?: number;
    showFastBackward?: boolean;
    showFastForward?: boolean;
  }>(),
  {
    showFastBackward: true,
    showFastForward: true,
    maxPagesInNav: 5,
  },
);

/* Emits */
const emit = defineEmits(['update:currentPage', 'update:perPage']);

/* State */
const internalPerPage = ref(props.perPage || 10);

/* Watchers */
watch(() => props.perPage, (newVal) => {
  if (newVal != null && newVal !== internalPerPage.value) {
    internalPerPage.value = newVal;
  }
});

/* Computed */
const totalPages = computed(() => Math.ceil(props.totalItems / internalPerPage.value));
const visiblePages = computed(() => {
  const pages: (number | string)[] = [];

  const start = Math.max(2, props.currentPage - 1);
  const end = Math.min(totalPages.value - 1, props.currentPage + 1);

  // Always include the first page
  pages.push(1);

  // Include '...' if there are pages skipped before the current range
  if (start > 2) {
    pages.push('...');
  }

  // Include two pages around the current page
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Include '...' if there are pages skipped after the current range
  if (end < totalPages.value - 1) {
    pages.push('...');
  }

  // Always include the last page
  if (totalPages.value > 1) {
    pages.push(totalPages.value);
  }

  return pages;
});
const startItem = computed(() => (props.currentPage - 1) * internalPerPage.value + 1);
const endItem = computed(() =>
  Math.min(props.currentPage * internalPerPage.value, props.totalItems),
);

/* Handlers */
const handlePageSelect = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  emit('update:currentPage', page);
};

const handlePerPageSelect = (newPerPage: number) => {
  const oldStartItem = startItem.value;
  const newPage = Math.ceil(oldStartItem / newPerPage);

  internalPerPage.value = newPerPage;

  emit('update:perPage', newPerPage);
  emit('update:currentPage', newPage);
};
</script>
<template>
  <div class="pager gap-4">
    <div class="d-none d-xl-flex align-items-center">
      <div class="pager-per-page">
        <select
          class="form-select is-fill"
          :value="internalPerPage"
          @change="handlePerPageSelect(Number(($event.target as HTMLSelectElement).value))"
        >
          <template v-for="num in [5, 10, 20, 50]" :key="num">
            <option :value="num">
              {{ num }}
            </option>
          </template>
        </select>
      </div>
      <p class="ms-3 text-small">items per page</p>
    </div>

    <nav class="pager-navigation">
      <ul class="pagination">
        <li
          v-if="visiblePages.length > 1"
          class="page-item"
          @click="handlePageSelect(currentPage - 1)"
        >
          <a class="page-link text-body">
            <span class="bi bi-chevron-left"></span>
          </a>
        </li>

        <template v-for="page in visiblePages" :key="page">
          <li
            class="page-item text-main"
            :class="{ active: page === currentPage }"
            @click="typeof page === 'number' ? handlePageSelect(page) : {}"
          >
            <a class="page-link">{{ page }}</a>
          </li>
        </template>

        <li
          v-if="visiblePages.length > 1"
          class="page-item"
          @click="handlePageSelect(currentPage + 1)"
        >
          <a class="page-link text-body">
            <span class="bi bi-chevron-right"></span>
          </a>
        </li>
      </ul>
    </nav>

    <div class="pager-shown-items text-small">
      <span>{{ startItem }}</span>
      <span>-</span>
      <span>{{ endItem }}</span>
      <span> of </span>
      <span>{{ totalItems }} items</span>
    </div>
  </div>
</template>
