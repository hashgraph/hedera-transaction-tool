<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Prisma } from '@prisma/client';
import { PrivateKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { decryptEncryptedKey } from '@renderer/services/encryptedKeys';
import { uploadKey } from '@renderer/services/organization';

import { assertUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import { storeKeyPair } from '@renderer/services/keyPairService';

/* Props */
const props = defineProps<{
  show: boolean;
  keyPath: string | null;
  keysLeft: number;
  mnemonic: string[] | null;
  mnemonicHash: string | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'skip:one'): void;
  (event: 'skip:all'): void;
  (event: 'stored'): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const decryptPassword = ref<string>('');
const decrypting = ref<boolean>(false);
const error = ref<string | null>(null);

const decryptedKeys = ref<string[]>([]);
const alreadyExisitngPaths = ref<string[]>([]);

/* Computed */
const fileName = computed(() => {
  if (!props.keyPath) return '';
  return props.keyPath.split('/').pop();
});

/* Handlers */
const handleSkipAll = () => emit('skip:all');
const handleSkip = () => emit('skip:one');
const handleSubmit = async (event: Event) => {
  event.preventDefault();
  await decrypt();
};

const handleClose = (show: boolean) => {
  reset();
  emit('skip:all');
  emit('update:show', show);
};

/* Function */
async function decrypt() {
  if (!props.keyPath) throw new Error('Key path is not provided');

  let privateKeyDer: string | null = null;

  decrypting.value = true;
  error.value = null;

  try {
    privateKeyDer = await decryptEncryptedKey(props.keyPath, decryptPassword.value);
  } catch (err) {
    error.value = err instanceof Error && err.message ? err.message : 'Failed to decrypt key';
    decrypting.value = false;
  }

  if (privateKeyDer) {
    try {
      await storeKey(privateKeyDer);
      emit('stored');
    } catch (error) {
      decrypting.value = false;
      throw error;
    }
  }
}

async function storeKey(privateKeyDer: string) {
  assertUserLoggedIn(user.personal);
  const personalPassword = user.getPassword();
  if (!personalPassword) throw new Error('Personal password not found');

  const privateKey = PrivateKey.fromStringDer(privateKeyDer);
  const publicKey = privateKey.publicKey;

  if (
    user.keyPairs.some(k => k.public_key === publicKey.toStringRaw()) ||
    decryptedKeys.value.includes(publicKey.toStringRaw())
  ) {
    alreadyExisitngPaths.value.push(props.keyPath || '');
    throw new Error(`${publicKey.toStringRaw()} already exists`);
  }

  const keyPair: Prisma.KeyPairUncheckedCreateInput = {
    user_id: user.personal.id,
    index: -1,
    private_key: privateKey.toStringRaw(),
    public_key: publicKey.toStringRaw(),
    type: publicKey._key._type === 'secp256k1' ? 'ECDSA' : 'ED25519',
    organization_id: null,
    organization_user_id: null,
    secret_hash: null,
    nickname: null,
  };

  if (isLoggedInOrganization(user.selectedOrganization)) {
    if (user.selectedOrganization.userKeys.some(k => k.publicKey === publicKey.toStringRaw())) {
      throw new Error(`${publicKey.toStringRaw()} already exists`);
    }

    keyPair.organization_id = user.selectedOrganization.id;
    keyPair.organization_user_id = user.selectedOrganization.userId;

    await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
      publicKey: publicKey.toStringRaw(),
      // index: keyPair.index,
      // mnemonicHash: props.mnemonicHash || undefined,
    });
  }

  await storeKeyPair(keyPair, personalPassword, false);

  decryptedKeys.value.push(publicKey.toStringRaw());
}

function reset() {
  error.value = null;
  decryptPassword.value = '';
}

/* Watchers */
watch(
  () => props.show,
  () => reset(),
);

watch(
  () => props.keyPath,
  async keyPath => {
    if (decryptPassword.value.trim().length > 0 && keyPath) {
      await decrypt();
    }
  },
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleClose"
    class="medium-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose(false)"></i>
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Decrypt key</h3>

        <div class="form-group mt-4">
          <label class="form-label">Enter Decryption Password</label>
          <AppInput
            v-model="decryptPassword"
            size="small"
            type="password"
            name="decrypt-key-password"
            :filled="true"
            :disabled="decrypting"
            placeholder="Type password to decypt the keys"
            data-testid="input-decrypt-keys-password"
          />
        </div>

        <p class="text-truncate mt-4">Encrypted file name: {{ fileName }}</p>

        <div class="flex-between-centered gap-4 mt-4">
          <div v-if="error" class="overflow-hidden">
            <p class="text-danger text-truncate">
              {{ error }}
            </p>
          </div>
          <div class="flex-grow-1 flex-shrink-0">
            <p class="text-end">{{ keysLeft }} keys left</p>
          </div>
        </div>

        <hr class="separator mb-5 mt-2" />

        <div class="flex-between-centered gap-4 overflow-hidden">
          <AppButton
            color="primary"
            type="button"
            class="min-w-unset"
            :disabled="decrypting"
            @click="handleSkipAll"
            >Skip Rest</AppButton
          >
          <div class="flex-between-centered gap-4">
            <AppButton
              color="secondary"
              type="button"
              class="min-w-unset"
              :disabled="decrypting"
              @click="handleSkip"
              >Skip</AppButton
            >
            <AppButton
              color="primary"
              type="submit"
              class="min-w-unset"
              :disabled="
                decryptPassword.trim().length === 0 ||
                decrypting ||
                alreadyExisitngPaths.includes(props.keyPath || '')
              "
              :loading="decrypting"
              loading-text="Decrypting..."
              >Decrypt</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
