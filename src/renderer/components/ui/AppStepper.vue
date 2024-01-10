<script setup lang="ts">
/* Props */
defineProps<{
  items: { title: string; name: string }[];
  activeIndex: number;
  itemClickable?: boolean;
  handleItemClick?: (item: { title: string; name: string }, index: number) => void;
}>();
</script>
<template>
  <div class="stepper">
    <div class="stepper-head position-relative">
      <hr class="position-relative m-0" />
      <div class="stepper-nav position-relative d-flex justify-content-around">
        <template v-for="(item, index) in items" :key="index">
          <div
            class="stepper-nav-item position-relative"
            :class="{ 'stepper-active': activeIndex === index, 'cursor-pointer': itemClickable }"
            @click="handleItemClick && handleItemClick(item, index)"
          >
            <div class="stepper-nav-item-bubble p-2 text-small rounded-circle border border-dark">
              <template v-if="activeIndex <= index">
                {{ index + 1 }}
              </template>
              <template v-else>
                <i class="bi bi-check-lg"></i>
              </template>
            </div>
            <span class="stepper-nav-item-title text-small position-absolute mt-2">{{
              item.title
            }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
