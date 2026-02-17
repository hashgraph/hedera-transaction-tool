<script setup lang="ts">
/* Props */
const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'secondary' | 'borderless' | 'danger';
    loading?: boolean;
    loadingText?: string;
    disabled?: boolean;
    disableOnLoading?: boolean;
    size?: 'small' | 'large' | 'default';
    outline?: boolean;
  }>(),
  {
    disableOnLoading: true,
  },
);

/* Misc */
const sizeMapping = {
  small: 'btn-sm',
  large: 'btn-lg',
  default: '',
};

const outlinePrefix = props.outline ? '-outline' : '';
const colorMapping = {
  primary: `btn${outlinePrefix}-primary`,
  secondary: `btn${outlinePrefix}-secondary`,
  borderless: `btn${outlinePrefix}-borderless`,
  danger: `btn${outlinePrefix}-danger`,
};
</script>
<template>
  <button
    :disabled="disabled || (loading && disableOnLoading)"
    :class="['btn', color ? colorMapping[color] : '', sizeMapping[size || 'default']]"
  >
    <template v-if="loading">
      <span class="spinner-border spinner-border-sm me-2" role="status" inert></span>{{ ' ' }}
      <span v-if="loadingText">{{ loadingText }}</span>
      <span v-else>Loading...</span>
    </template>
    <template v-else>
      <slot></slot>
    </template>
  </button>
</template>
<style scoped>
button {
  height: 40px;
}
</style>
