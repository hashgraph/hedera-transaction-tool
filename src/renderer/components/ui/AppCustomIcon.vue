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
defineProps<{
  name: CustomIcon;
  imageClass?: string;
}>();

/* Misc */
const iconMapping: {
  [key in CustomIcon]: string;
} = {
  bin: 'Bin',
  contact: 'Conact',
  draft: 'Draft',
  error: 'Error',
  group: 'Group',
  lock: 'Lock',
  questionMark: 'QuestionMark',
  success: 'Success',
};
</script>
<template>
  <div>
    <img
      :src="`/images/customIcons/${iconMapping[name]}.png`"
      :alt="name"
      class="h-100"
      :class="imageClass"
    />
  </div>
</template>
