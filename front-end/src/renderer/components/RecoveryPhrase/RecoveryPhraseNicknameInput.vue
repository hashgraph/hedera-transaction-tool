<script setup lang="ts">
import type { Props } from '@renderer/components/ui/AppInput.vue';

import { watch } from 'vue';

import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<
  Props & {
    mnemonicHash?: string | null;
  }
>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Composables */
const recoveryPhraseNickname = useRecoveryPhraseNickname();

/* Handlers */
const handleNicknameUpdate = async (value: string) => {
  emit('update:modelValue', value);
};

/* Hooks */
watch(
  () => props.mnemonicHash,
  mnemonicHash => {
    if (mnemonicHash) {
      const nickname = recoveryPhraseNickname.get(mnemonicHash);
      emit('update:modelValue', nickname || '');
    } else {
      emit('update:modelValue', '');
    }
  },
);
</script>
<template>
  <AppInput
    :model-value="modelValue"
    @update:model-value="handleNicknameUpdate"
    placeholder="Enter Recovery Phrase Nickname"
    type="text"
    :filled="filled"
    :size="size"
    :auto-trim="autoTrim"
  />
</template>
