<script setup lang="ts">
/* Types */
type CustomIcon =
  | 'bin'
  | 'contact'
  | 'draft'
  | 'error'
  | 'group'
  | 'lock'
  | 'questionMark'
  | 'success';

/* Props */
const props = defineProps<{
  name: CustomIcon;
  imageClass?: string;
}>();

/* Misc */
const iconMapping: {
  [key in CustomIcon]: string;
} = {
  bin: 'bin',
  contact: 'contact',
  draft: 'draft',
  error: 'error',
  group: 'group',
  lock: 'lock',
  questionMark: 'questionMark',
  success: 'success',
};
console.log(import.meta.url);

const imageUrl = new URL(`../../assets/icons/${iconMapping[props.name]}.png`, import.meta.url).href;
</script>
<template>
  <div>
    <img :src="imageUrl" :alt="name" class="h-100" :class="imageClass" />
  </div>
</template>
