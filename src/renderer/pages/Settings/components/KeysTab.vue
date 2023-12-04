<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import AppButton from '../../../components/ui/AppButton.vue';

const keyPairsStore = useKeyPairsStore();

const keyIndex = ref(0);

const handleGenerateKeyPair = async () => {
  keyPairsStore.generatePrivateKey('', keyIndex.value);
};

onMounted(() => {
  keyPairsStore.refetch();
});
</script>
<template>
  <div>
    <div class="d-flex align-items-center">
      <AppButton color="primary" @click="handleGenerateKeyPair" class="me-6"
        >Generate new key pair</AppButton
      >
      <label class="form-label text-subheader me-3">Index</label>
      <input
        v-model="keyIndex"
        type="number"
        min="0"
        class="form-control py-2"
        style="width: 75px"
      />
    </div>
    <div
      v-for="keyPair in keyPairsStore.keyPairs"
      :key="keyPair.publicKey"
      class="mt-5 p-4 bg-dark-blue-800"
    >
      <span class="text-muted text-small d-flex justify-content-end"
        >Index: {{ keyPair.index }}</span
      >
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
