<script setup lang="ts">
import AppButton from './AppButton.vue';

/* Interfaces */
export interface TabItem {
  title: string;
  notifications?: number;
}

/* Props */
defineProps<{
  items: TabItem[];
  activeIndex: number;
  navClass?: string;
  navItemClass?: string;
  navItemButtonClass?: string;
}>();

/* Emits */
defineEmits(['update:active-index']);
</script>

<template>
  <div class="tabs">
    <ul class="nav nav-tabs" :class="[navClass]">
      <li class="nav-item p-0" :class="[navItemClass]" v-for="(item, i) in items" :key="item.title">
        <AppButton
          class="tab-button text-small fw-medium gap-3 w-100"
          :class="[i === activeIndex ? 'active border-main-gradient' : '', navItemButtonClass]"
          @click="$emit('update:active-index', i)"
        >
          {{ item.title }}
          <span
            v-if="item.notifications"
            class="notification d-inline-block rounded-circle bg-primary text-white"
            >{{ item.notifications.toFixed(0) }}</span
          >
        </AppButton>
      </li>
    </ul>
    <div class="mt-6">
      <slot :name="items[activeIndex].title"></slot>
    </div>
  </div>
</template>
