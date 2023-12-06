<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { decryptPrivateKey } from '../../../services/keyPairService';

import useKeyPairsStore from '../../../stores/storeKeyPairs';
import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';
import useUserStateStore from '../../../stores/storeUserState';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();

onMounted(() => {
  keyPairsStore.refetch();
});

const isDecryptedModalShown = ref(false);
const decryptedKey = ref<string | null>(null);
const publicKeysPrivateKeyToDecrypt = ref('');
const userPassword = ref('');

const handleShowDecryptModal = (publicKey: string) => {
  publicKeysPrivateKeyToDecrypt.value = publicKey;
  isDecryptedModalShown.value = true;
};

const handleDecrypt = async () => {
  if (!userStateStore.userData?.userId) {
    throw Error('No user selected');
  }

  decryptedKey.value = await decryptPrivateKey(
    userStateStore.userData?.userId,
    userPassword.value,
    publicKeysPrivateKeyToDecrypt.value,
  );
};

watch(isDecryptedModalShown, newVal => {
  if (newVal) {
    decryptedKey.value = null;
  }
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
      <div class="d-flex justify-content-between align-items-center">
        <div class="mb-3 d-flex">
          <p class="me-3 text-secondary text-bold text-main">Index: {{ keyPair.index }}</p>
          <p v-if="keyPair.nickname" class="text-secondary text-bold text-main">
            Nickname: {{ keyPair.nickname }}
          </p>
        </div>
        <AppButton size="small" color="primary" @click="handleShowDecryptModal(keyPair.publicKey)"
          >Decrypt Private Key</AppButton
        >
      </div>
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
    <AppModal v-model:show="isDecryptedModalShown" class="common-modal">
      <div class="p-5 container-modal-card" style="width: 356px">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isDecryptedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <Transition name="fade" mode="out-in">
            <i
              v-if="!decryptedKey"
              class="bi bi-lock extra-large-icon cursor-pointer"
              style="line-height: 16px"
              @click="isDecryptedModalShown = false"
            ></i>
            <i
              v-else
              class="bi bi-unlock extra-large-icon cursor-pointer"
              style="line-height: 16px"
              @click="isDecryptedModalShown = false"
            ></i>
          </Transition>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>
        <input
          v-model="userPassword"
          type="password"
          class="mt-5 form-control rounded-4"
          placeholder="Type your password"
        />
        <input v-model="decryptedKey" type="text" class="mt-4 form-control rounded-4" readonly />
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          :disabled="userPassword.length === 0"
          @click="handleDecrypt"
          >Decrypt</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
