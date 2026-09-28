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
  return (
    index < props.activeIndex || (props.activeIndex === index && index === props.items.length - 1)
  );
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
            >
              <span v-if="isActive(index) || props.activeIndex < index"> {{ index + 1 }}</span>
              <template v-else-if="isCompleted(index)">
                <i v-if="item.bubbleIcon" :class="['bi', `bi-${item.bubbleIcon}`]" />
                <span v-else-if="item.bubbleLabel">{{ item.bubbleLabel }}</span>
                <i v-else class="bi bi-check-lg" />
              </template>
              <i v-else class="bi bi-check-lg" />
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
