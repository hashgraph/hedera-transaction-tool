<script setup lang="ts">
import { ref, onMounted } from 'vue';

import axios from 'axios';

import { getMirrorNodeConfig } from '../../../services/configurationService';
import { getStoredKeyPairs, generateKeyPair } from '../../../services/keyPairService';

const keyPairs = ref<{ privateKey: string; publicKey: string; accountId?: string }[]>([]);

onMounted(async () => {
  keyPairs.value = await getStoredKeyPairs();
});

const index = ref(0);
const handleGenerateKeyPair = async () => {
  try {
    const newKeyPair = await generateKeyPair('', index.value++);
    if (newKeyPair) {
      const mainnetLink = (await getMirrorNodeConfig()).mainnetLink;
      let accountId;

      try {
        const {
          data: { accounts },
        } = await axios.get(`${mainnetLink}/accounts/?account.publickey=${newKeyPair.publicKey}`);
        if (accounts.length > 0) {
          accountId = accounts[0].account;
        }
      } catch (error) {
        console.log('error', error);
      }
      keyPairs.value = [...keyPairs.value, { ...newKeyPair, accountId }];
    }
  } catch (error) {
    console.log(error);
  }
};
</script>
<template>
  <div>
    <button class="btn btn-secondary" @click="handleGenerateKeyPair">Generate new key pair</button>
    <div v-for="keyPair in keyPairs" :key="keyPair.publicKey" class="mt-5 p-4 bg-dark-blue-800">
      <div class="form-group">
        <label class="form-label">Encoded Private key</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.privateKey" />
      </div>
      <div class="form-group mt-3">
        <label class="form-label">Encoded Public key</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.publicKey" />
      </div>
      <div v-show="keyPair.accountId" class="form-group mt-3">
        <label class="form-label">Account ID</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.accountId" />
      </div>
    </div>
  </div>
</template>
