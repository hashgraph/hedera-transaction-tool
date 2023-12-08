<script setup lang="ts">
import { ref, watch } from 'vue';

import { Client, FileContentsQuery } from '@hashgraph/sdk';

import { decryptPrivateKey } from '../../../services/keyPairService';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';
import useUserStateStore from '../../../stores/storeUserState';

const keyPairsStore = useKeyPairsStore();
const userStateStore = useUserStateStore();

const isUserPasswordModalShown = ref(false);
const userPassword = ref('');

const payerId = ref('');
const fileId = ref('');

const content = ref('');

const handleRead = async () => {
  if (!userStateStore.userData?.userId) return;

  const publicKey = keyPairsStore.keyPairs.find(kp => kp.accountId === payerId.value)?.publicKey;

  const privateKey = await decryptPrivateKey(
    userStateStore.userData?.userId,
    userPassword.value,
    publicKey || '',
  );

  const client = Client.forTestnet();
  client.setOperator(payerId.value, privateKey);

  const query = new FileContentsQuery().setFileId(fileId.value);

  const contents = await query.execute(client);

  isUserPasswordModalShown.value = false;

  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(contents);

  content.value = text;
};

watch(isUserPasswordModalShown, () => (userPassword.value = ''));
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Read File Query</span>
      </div>
      <div>
        <AppButton
          size="small"
          color="primary"
          class="px-4 rounded-4"
          :disabled="!fileId || !payerId"
          @click="isUserPasswordModalShown = true"
          >Read</AppButton
        >
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Payer ID</label>
        <select v-model="payerId" class="form-control py-3" placeholder="Enter Payer ID">
          <option
            v-for="kp in keyPairsStore.keyPairs.filter(kp => kp.accountId)"
            :key="kp.accountId"
            :value="kp.accountId"
          >
            {{ kp.accountId }}
          </option>
        </select>
      </div>
      <div class="form-group w-50">
        <label class="form-label">Set File ID</label>
        <input
          v-model="fileId"
          type="text"
          class="form-control py-3"
          placeholder="Enter owner public key"
        />
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea v-model="content" class="form-control py-3" rows="10" readonly></textarea>
      </div>
    </div>
    <AppModal v-model:show="isUserPasswordModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isUserPasswordModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-shield-lock extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>
        <div class="mt-4 form-group">
          <input v-model="userPassword" type="password" class="form-control rounded-4" />
        </div>
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4" @click="handleRead"
          >Sign Query</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
