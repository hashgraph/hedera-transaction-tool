<script setup lang="ts">
import AppButton from './AppButton.vue';

export interface TabItem {
  title: string;
  notifications?: number;
  content?: any;
}

defineProps<{ items: TabItem[]; activeIndex: number }>();
defineEmits(['update:active-index']);
</script>

<template>
  <div class="tabs">
    <ul class="nav nav-tabs">
      <li class="nav-item p-0" v-for="(item, i) in items" :key="item.title">
        <AppButton
          class="link-menu nav-link text-small gap-3"
          :class="{
            active: i === activeIndex,
            'border-main-gradient': i === activeIndex,
          }"
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
