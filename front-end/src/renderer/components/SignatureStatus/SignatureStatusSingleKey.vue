<script setup lang="ts">
import { computed } from 'vue';
import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';
import type { PublicKey } from '@hiero-ledger/sdk';

/* Props */
const props = defineProps<{
  publicKey: PublicKey;
  signed: boolean;
  ableToSign: boolean;
  external: boolean;
  depth?: number;
  index?: number;
}>();

/* Computed */
const imageTestid = computed(() => {
  let result: string;
  if (props.depth !== undefined && props.index !== undefined) {
    result = `span-checkmark-public-key-${props.depth}-${props.index}`;
  } else {
    result = 'span-checkmark-payer-key';
  }
  return result;
});
const nicknameTestId = computed(() => {
  let result: string;
  if (props.depth !== undefined && props.index !== undefined) {
    result = `span-public-key-${props.depth}-${props.index}`;
  } else {
    result = 'span-payer-key';
  }
  return result;
});
</script>

<template>
  <span
    v-if="props.signed"
    class="bi bi-check-lg text-success position-absolute"
    :style="{ left: '-15px' }"
    :data-testid="imageTestid"
  ></span>
  <p class="text-nowrap me-2" :data-testid="nicknameTestId">
    <AppPublicKeyNickname
      :public-key="props.publicKey.toStringRaw()"
      class="me-2"
      :signed="props.signed"
      :external="props.external"
    />
  </p>
</template>

<style scoped></style>
