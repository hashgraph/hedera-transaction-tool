<script setup lang="ts">
import type { SignatureAudit } from '@renderer/utils';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';

/* Props */
const props = defineProps<{
  signatureKeyObject: SignatureAudit | null;
  signersPublicKeys: string[];
  showExternal: boolean;
}>();

</script>

<template>
  <h2 v-if="props.signatureKeyObject !== null" class="text-title text-bold">
    Signatures Collected
  </h2>
  <div v-if="props.signatureKeyObject !== null" class="text-small mt-5">
    <SignatureStatus
      :signature-key-object="props.signatureKeyObject"
      :public-keys-signed="signersPublicKeys"
      :show-external="showExternal"
    />
  </div>
</template>

<style scoped></style>
