<script setup lang="ts">
/* Props */
defineProps<{
  items: {
    title: string;
    name: string;
    bubbleClass?: string;
    bubbleLabel?: string;
    bubbleIcon?: string;
  }[];
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
            <div
              class="stepper-nav-item-bubble text-small rounded-circle border border-dark p-2"
              :class="[item.bubbleClass && `${item.bubbleClass}`]"
              :data-testid="`div-stepper-nav-item-bubble-${index}`"
            >
              <template v-if="activeIndex <= index">
                <template v-if="item.bubbleIcon">
                  <i class="bi" :class="[`bi-${item.bubbleIcon}`]"></i>
                </template>
                <template v-else-if="item.bubbleLabel">
                  {{ item.bubbleLabel }}
                </template>
                <template v-else>
                  {{ index + 1 }}
                </template>
              </template>
              <template v-else>
                <i class="bi bi-check-lg"></i>
              </template>
            </div>
            <span
              :data-testid="`stepper-title-${index}`"
              class="stepper-nav-item-title text-micro position-absolute mt-3"
              >{{ item.title }}</span
            >
          </div>
          <hr class="flex-1 m-0" />
        </template>
      </div>
    </div>
  </div>
</template>
