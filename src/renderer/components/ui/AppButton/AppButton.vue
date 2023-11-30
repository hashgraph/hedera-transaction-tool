<script setup lang="ts">
const props = defineProps<{
  color?: 'primary' | 'secondary';
  loading?: boolean;
  loadingText?: string;
  size?: 'small' | 'large' | 'default';
  outline?: boolean;
}>();

const sizeMapping = {
  small: 'btn-sm',
  large: 'btn-lg',
  default: '',
};

const outlinePrefix = props.outline ? '-outline' : '';
const colorMapping = {
  primary: `btn${outlinePrefix}-primary`,
  secondary: `btn${outlinePrefix}-secondary`,
};
</script>
<template>
  <button :class="['btn', color ? colorMapping[color] : '', sizeMapping[size || 'default']]">
    <template v-if="loading">
      <span class="spinner-border spinner-border-sm me-3" role="status" aria-hidden="true"
        >{{ ' ' }}
        <span v-if="loadingText">{{ loadingText }}</span>
        <span v-else>Loading...</span>
      </span>
    </template>
    <template v-else>
      <slot></slot>
    </template>
  </button>
</template>
