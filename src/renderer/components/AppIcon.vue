<script setup lang="ts">
import { DefineComponent } from 'vue';
import IconUser from './icons/IconUser.vue';
import IconToken from './icons/IconToken.vue';

interface IconMapping {
  [key: string]: DefineComponent<{}, {}, any>;
}

interface ColorMapping {
  [key: string]: string;
}

const iconMapping: IconMapping = {
  user: IconUser,
  token: IconToken,
};

const colorMapping: ColorMapping = {
  danger: 'is-danger',
  success: 'is-success',
};

const props = defineProps<{
  title: string;
  color?: string;
}>();

const generatedClasses = ['icon', props.color ? colorMapping[props.color] : ''];
const componentName = iconMapping[props.title];
</script>

<template>
  <span :class="generatedClasses"><component :is="componentName" /></span>
</template>
