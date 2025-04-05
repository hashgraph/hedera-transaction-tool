<script setup lang="ts">
/* Props */
const props = defineProps<{
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

/* Functions */
const isActive = (index: number) => {
  return index === props.activeIndex && index !== props.items.length - 1;
};

const isCompleted = (index: number) => {
  return index < props.activeIndex ||
    (props.activeIndex === index && index === props.items.length - 1);
};

const getBubbleContent = (index: number, item: { bubbleIcon?: string; bubbleLabel?: string }) => {
  if (isActive(index) || props.activeIndex < index) {
    return index + 1;
  } else if (isCompleted(index)) {
    if (item.bubbleIcon) {
      return `<i class="bi bi-${item.bubbleIcon}"></i>`;
    } else if (item.bubbleLabel) {
      return item.bubbleLabel;
    } else {
      return '<i class="bi bi-check-lg"></i>';
    }
  } else {
    return '<i class="bi bi-check-lg"></i>';
  }
};
</script>
<template>
  <div class="stepper">
    <div class="stepper-head position-relative">
      <div class="stepper-nav position-relative d-flex justify-content-around align-items-center">
        <hr class="flex-1 m-0" />
        <template v-for="(item, index) in items" :key="index">
          <div
            class="stepper-nav-item position-relative"
            :class="{ 'stepper-active': isActive(index), 'cursor-pointer': itemClickable }"
            @click="handleItemClick && handleItemClick(item, index)"
          >
            <div
              class="stepper-nav-item-bubble text-small rounded-circle border border-dark p-2"
              :class="[isCompleted(index) ? item.bubbleClass : '']"
              :data-testid="`div-stepper-nav-item-bubble-${index}`"
              v-html="getBubbleContent(index, item)"
            ></div>
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
