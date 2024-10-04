<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';

import { ref, watch } from 'vue';

import { getDataMigrationKeysPath } from '@renderer/services/migrateDataService';
import { searchEncryptedKeys } from '@renderer/services/encryptedKeys';

import DecryptKeys from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeys.vue';

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
  recoveryPhrasePassword: string;
}>();

/* Emits */
defineEmits<{
  (event: 'keysImported', importedCount: number): void;
}>();

/* State */
const decryptKeysRef = ref<InstanceType<typeof DecryptKeys> | null>(null);

/* Watchers */
watch(decryptKeysRef, async () => {
  if (!decryptKeysRef.value) return;

  const keysPath = await getDataMigrationKeysPath();
  const encryptedKeyPaths = await searchEncryptedKeys([keysPath]);
  await decryptKeysRef.value?.process(encryptedKeyPaths, props.recoveryPhrase.words);
});
</script>
<template>
  <div>
    <DecryptKeys
      ref="decryptKeysRef"
      :default-password="recoveryPhrasePassword"
      @end="$emit('keysImported', $event)"
    />
  </div>
</template>
