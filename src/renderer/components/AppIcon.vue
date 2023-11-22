<script setup lang="ts">
import { DefineComponent } from 'vue';
import IconUser from './icons/IconUser.vue';
import IconToken from './icons/IconToken.vue';
import IconArrowSwapHorizontal from './icons/IconArrowSwapHorizontal.vue';
import IconStar from './icons/IconStar.vue';

interface IconMapping {
  [key: string]: DefineComponent<{}, {}, any>;
}

interface ColorMapping {
  [key: string]: string;
}

const iconMapping: IconMapping = {
  user: IconUser,
  token: IconToken,
  arrowSwapHorizontal: IconArrowSwapHorizontal,
  iconStar: IconStar,
};

const colorMapping: ColorMapping = {
  danger: 'is-danger',
  success: 'is-success',
};

const props = defineProps<{
  title: string;
  color?: string;
  bold?: boolean;
}>();

const generatedClasses = ['icon', props.color ? colorMapping[props.color] : ''];
const componentName = iconMapping[props.title];
</script>

<template>
  <span :class="generatedClasses"><component :bold="bold" :is="componentName" /></span>
</template>
