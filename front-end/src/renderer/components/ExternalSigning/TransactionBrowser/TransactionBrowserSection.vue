<script lang="ts" setup>
/* Props */
const props = withDefaults(
  defineProps<{
    alone?: boolean;
  }>(),
  {
    alone: false,
  },
);
</script>

<template>
  <div
    :class="{
      'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3': !props.alone,
      'col-12 my-3': props.alone,
    }"
    class="py-3"
  >
    <h4 class="text-micro text-semi-bold text-dark-blue">
      <slot name="label" />
    </h4>
    <p class="text-small mt-1 text-break">
      <slot name="value" />
    </p>
  </div>
</template>
