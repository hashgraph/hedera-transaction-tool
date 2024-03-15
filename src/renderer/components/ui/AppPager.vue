<script setup lang="ts">
import { computed, ref } from 'vue';

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

/* Computed */
const totalPages = computed(() => Math.ceil(props.totalItems / internalPerPage.value));
const visiblePages = computed(() => {
  const pages: number[] = [];

  const start = Math.max(1, props.currentPage - Math.floor(props.maxPagesInNav / 2));
  const end = Math.min(totalPages.value, start + props.maxPagesInNav - 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
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
        <li class="page-item" @click="handlePageSelect(1)">
          <a class="page-link">
            <span class="bi bi-skip-backward-fill"></span>
          </a>
        </li>
        <li class="page-item" @click="handlePageSelect(currentPage - 1)">
          <a class="page-link">
            <span class="bi bi-caret-left-fill"></span>
          </a>
        </li>

        <template v-for="page in visiblePages" :key="page">
          <li
            class="page-item text-main"
            :class="{ active: page === currentPage }"
            @click="handlePageSelect(page)"
          >
            <a class="page-link">{{ page }}</a>
          </li>
        </template>

        <li class="page-item" @click="handlePageSelect(currentPage + 1)">
          <a class="page-link">
            <span class="bi bi-caret-right-fill"></span>
          </a>
        </li>
        <li class="page-item" @click="handlePageSelect(totalPages)">
          <a class="page-link">
            <span class="bi bi-skip-forward-fill"></span>
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
