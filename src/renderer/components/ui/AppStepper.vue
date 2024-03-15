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
      <div class="stepper-nav position-relative d-flex justify-content-around align-items-center">
        <hr class="flex-1 m-0" />
        <template v-for="(item, index) in items" :key="index">
          <div
            class="stepper-nav-item position-relative"
            :class="{ 'stepper-active': activeIndex === index, 'cursor-pointer': itemClickable }"
            @click="handleItemClick && handleItemClick(item, index)"
          >
            <div class="stepper-nav-item-bubble text-small rounded-circle border border-dark p-2">
              <template v-if="activeIndex <= index">
                {{ index + 1 }}
              </template>
              <template v-else>
                <i class="bi bi-check-lg"></i>
              </template>
            </div>
            <span class="stepper-nav-item-title text-micro position-absolute mt-3">{{
              item.title
            }}</span>
          </div>
          <hr class="flex-1 m-0" />
        </template>
      </div>
    </div>
  </div>
</template>
