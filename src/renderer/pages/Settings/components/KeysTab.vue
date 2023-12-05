<script setup lang="ts">
import { onMounted } from 'vue';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

const keyPairsStore = useKeyPairsStore();

onMounted(() => {
  keyPairsStore.refetch();
});
</script>
<template>
  <div>
    <RouterLink class="btn btn-primary mb-4" :to="{ name: 'restoreKey' }">Restore key</RouterLink>

    <div
      v-for="keyPair in keyPairsStore.keyPairs"
      :key="keyPair.publicKey"
      class="rounded bg-dark-blue-700 p-4 mt-4"
    >
      <p class="text-secondary text-bold text-main mb-3">Index: {{ keyPair.index }}</p>
      <div class="form-group">
        <label class="form-label">ED25519 Private key</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.privateKey" />
      </div>
      <div class="form-group mt-3">
        <label class="form-label">ED25519 Public key</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.publicKey" />
      </div>
      <div v-show="keyPair.accountId" class="form-group mt-3">
        <label class="form-label">Account ID</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.accountId" />
      </div>
    </div>
  </div>
</template>
