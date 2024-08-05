<script setup lang="ts">
import { inject, reactive, ref, watch } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { generateExternalKeyPairFromString } from '@renderer/services/keyPairService';
import { comparePasswords } from '@renderer/services/userService';
import { uploadKey } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const isImportECDSAKeyModalShown = ref(false);
const isImportED25519KeyModalShown = ref(false);
const ecdsaKey = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});
const ed25519Key = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});

/* Handlers */
const handleImportExternalKey = async (type: 'ED25519' | 'ECDSA') => {
  const privateKey = type === 'ED25519' ? ed25519Key.privateKey : ecdsaKey.privateKey;
  const nickname = type === 'ED25519' ? ed25519Key.nickname : ecdsaKey.nickname;

  const callback = async () => {
    /* Verify user is logged in with password */
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
    const personalPassword = user.getPassword();
    if (!personalPassword) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      isImportED25519KeyModalShown.value = false;
      isImportECDSAKeyModalShown.value = false;
      userPasswordModalRef.value?.open(
        'Enter personal password',
        'Private key/s will be encrypted with this password',
        callback,
      );
      return;
    }

    try {
      const keyPair: Prisma.KeyPairUncheckedCreateInput = {
        user_id: user.personal.id,
        ...generateExternalKeyPairFromString(privateKey, type, nickname || ''),
        organization_id: null,
        organization_user_id: null,
        type: type,
        secret_hash: null,
      };

      if (user.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
        throw new Error('Key pair already exists');
      }

      if (!(await comparePasswords(user.personal.id, personalPassword))) {
        throw new Error('Incorrect password');
      }

      if (isLoggedInOrganization(user.selectedOrganization)) {
        if (
          user.selectedOrganization.userKeys.some(k => k.publicKey === keyPair.public_key) &&
          user.keyPairs.find(kp => kp.public_key === keyPair.public_key)
        ) {
          throw new Error('Key pair already exists');
        }

        keyPair.organization_id = user.selectedOrganization.id;
        keyPair.organization_user_id = user.selectedOrganization.userId;

        await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
          publicKey: keyPair.public_key,
        });
      }

      await user.storeKey(keyPair, null, userPassword.value, false);

      await user.refetchUserState();

      isImportED25519KeyModalShown.value = false;
      isImportECDSAKeyModalShown.value = false;

      toast.success(`${type} private key imported successfully`, { position: 'bottom-right' });
    } catch (err: any) {
      toast.error(err.message || `Failed to import ${type} private key`, {
        position: 'bottom-right',
      });
    }
  };

  await callback();
};

/* Watchers */
watch([isImportECDSAKeyModalShown, isImportED25519KeyModalShown], (ecdsa, ed25519) => {
  if (ecdsa) {
    ecdsaKey.nickname = '';
    ecdsaKey.privateKey = '';
  }
  if (ed25519) {
    ed25519Key.nickname = '';
    ed25519Key.privateKey = '';
  }
});
</script>
<template>
  <div>
    <div class="dropdown">
      <AppButton
        color="primary"
        data-testid="button-restore-dropdown"
        class="w-100 d-flex align-items-center justify-content-center"
        data-bs-toggle="dropdown"
        v-bind="$attrs"
        ><i class="bi bi-plus text-main me-2"></i> Import</AppButton
      >
      <ul class="dropdown-menu w-100 mt-3">
        <li
          data-testid="link-import-ed25519-key"
          class="dropdown-item cursor-pointer"
          @click="isImportED25519KeyModalShown = true"
        >
          <span class="text-small">ED25519 Key</span>
        </li>
        <li
          data-testid="link-import-ecdsa-key"
          class="dropdown-item cursor-pointer mt-3"
          @click="isImportECDSAKeyModalShown = true"
        >
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
              data-testid="input-ecdsa-private-key"
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
              data-testid="input-ecdsa-private-key-nickname"
              v-model="ecdsaKey.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>

          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton data-testid="button-ecdsa-private-key-import" type="submit" color="primary"
              >Import</AppButton
            >
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
              data-testid="input-ed25519-private-key"
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
              data-testid="input-ed25519-private-key-nickname"
              v-model="ed25519Key.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>

          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton data-testid="button-ed25519-private-key-import" type="submit" color="primary"
              >Import</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
