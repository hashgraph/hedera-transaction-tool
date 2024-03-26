<script setup lang="ts">
import { reactive, ref, watch } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import { generateExternalKeyPairFromString } from '@renderer/services/keyPairService';
import { comparePasswords } from '@renderer/services/userService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const isImportECDSAKeyModalShown = ref(false);
const isImportED25519KeyModalShown = ref(false);
const ecdsaKey = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});
const ed25519Key = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});
const userPassword = ref('');

/* Handlers */
const handleImportExternalKey = async (type: 'ED25519' | 'ECDSA') => {
  try {
    const privateKey = type === 'ED25519' ? ed25519Key.privateKey : ecdsaKey.privateKey;
    const nickname = type === 'ED25519' ? ed25519Key.nickname : ecdsaKey.nickname;

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.data.id,
      ...generateExternalKeyPairFromString(privateKey, type, nickname || ''),
      organization_id: user.data.activeOrganization?.id || null,
      type: type,
      secret_hash: null,
    };

    if (keyPairsStore.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
      throw new Error('Key pair already exists');
    }

    if (!(await comparePasswords(user.data.id, userPassword.value))) {
      throw new Error('Incorrect password');
    }

    await keyPairsStore.storeKeyPair(keyPair, userPassword.value);

    isImportED25519KeyModalShown.value = false;
    isImportECDSAKeyModalShown.value = false;

    toast.success('ED25519 private key imported successfully', { position: 'bottom-right' });
  } catch (err: any) {
    toast.error(err.message || 'Failed to import ED25519 private key', {
      position: 'bottom-right',
    });
  }
};

/* Watchers */
watch([isImportECDSAKeyModalShown, isImportED25519KeyModalShown], () => {
  userPassword.value = '';
  ecdsaKey.nickname = '';
  ecdsaKey.privateKey = '';
  ed25519Key.nickname = '';
  ed25519Key.privateKey = '';
});
</script>
<template>
  <div>
    <div class="dropdown">
      <AppButton
        color="primary"
        class="w-100 d-flex align-items-center justify-content-center"
        data-bs-toggle="dropdown"
        v-bind="$attrs"
        ><i class="bi bi-plus text-main me-2"></i> Import</AppButton
      >
      <ul class="dropdown-menu w-100 mt-3">
        <li class="dropdown-item cursor-pointer" @click="isImportED25519KeyModalShown = true">
          <span class="text-small">ED25519 Key</span>
        </li>
        <li class="dropdown-item cursor-pointer mt-3" @click="isImportECDSAKeyModalShown = true">
          <span class="text-small">ECDSA Key</span>
        </li>
      </ul>
    </div>
    <AppModal v-model:show="isImportECDSAKeyModalShown" class="common-modal">
      <div class="p-5">
        <i class="bi bi-x-lg cursor-pointer" @click="isImportECDSAKeyModalShown = false"></i>
        <div class="text-center mt-5">
          <i class="bi bi-key large-icon" style="line-height: 16px"></i>
        </div>
        <form
          @submit="
            e => {
              e.preventDefault();
              handleImportExternalKey('ECDSA');
            }
          "
        >
          <div class="form-group mt-4">
            <label class="form-label">Enter ECDSA Private key</label>
            <AppInput
              v-model="ecdsaKey.privateKey"
              :filled="true"
              size="small"
              name="private-key"
              placeholder="Type ECDSA Private key"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter nickname (optional)</label>
            <AppInput
              v-model="ecdsaKey.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>

          <div class="form-group mt-4">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
            />
          </div>
          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton type="submit" color="primary">Import</AppButton>
          </div>
        </form>
      </div>
    </AppModal>

    <AppModal v-model:show="isImportED25519KeyModalShown" class="common-modal">
      <div class="p-5">
        <i class="bi bi-x-lg cursor-pointer" @click="isImportED25519KeyModalShown = false"></i>
        <div class="text-center mt-5">
          <i class="bi bi-key large-icon"></i>
        </div>
        <form
          @submit="
            e => {
              e.preventDefault();
              handleImportExternalKey('ED25519');
            }
          "
        >
          <div class="form-group mt-4">
            <label class="form-label">Enter ED25519 Private key</label>
            <AppInput
              v-model="ed25519Key.privateKey"
              :filled="true"
              size="small"
              name="private-key"
              placeholder="Type ED25519 Private key"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter nickname (optional)</label>
            <AppInput
              v-model="ed25519Key.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
            />
          </div>
          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton type="submit" color="primary">Import</AppButton>
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
