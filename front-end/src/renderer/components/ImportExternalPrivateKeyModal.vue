<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';
import { inject, reactive, watch } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { generateExternalKeyPairFromString } from '@renderer/services/keyPairService';
import { uploadKey } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  keyType: 'ED25519' | 'ECDSA';
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const key = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});

const handleImportExternalKey = async (e: Event) => {
  e.preventDefault();

  const callback = async () => {
    /* Verify user is logged in with password */
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
    const personalPassword = user.getPassword();
    if (!personalPassword && !user.personal.useKeychain) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
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
        ...generateExternalKeyPairFromString(key.privateKey, props.keyType, key.nickname || ''),
        organization_id: null,
        organization_user_id: null,
        type: props.keyType,
        secret_hash: null,
      };

      if (user.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
        throw new Error('Key pair already exists');
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

      await user.storeKey(keyPair, null, personalPassword, false);

      await user.refetchUserState();

      emit('update:show', false);

      toast.success(`${props.keyType} private key imported successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to import ${props.keyType} private key`);
    }
  };

  await callback();
};

/* Watchers */
watch(
  () => props.show,
  () => {
    key.privateKey = '';
    key.nickname = '';
  },
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="$emit('update:show', $event)"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      <div class="text-center mt-5">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit="handleImportExternalKey">
        <div class="form-group mt-4">
          <label class="form-label">Enter {{ keyType }} Private key</label>
          <AppInput
            v-model="key.privateKey"
            size="small"
            name="private-key"
            :filled="true"
            :placeholder="`Type ${keyType} Private key`"
            :data-testid="`input-${keyType.toLocaleLowerCase()}-private-key`"
          />
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Enter nickname (optional)</label>
          <AppInput
            v-model="key.nickname"
            size="small"
            name="nickname"
            :filled="true"
            placeholder="Type nickname"
            :data-testid="`input-${keyType.toLocaleLowerCase()}-private-key-nickname`"
          />
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            :data-testid="`button-${keyType.toLocaleLowerCase()}-private-key-import`"
            type="submit"
            color="primary"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
