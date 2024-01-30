<script setup lang="ts">
import { onMounted, onUpdated, ref } from 'vue';

import { KeyPair } from '@prisma/client';

import useKeyPairsStore from '../../../stores/storeKeyPairs';
import useUserStore from '../../../stores/storeUser';

import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '../../../composables/useCreateTooltips';

import {
  restorePrivateKey,
  hashRecoveryPhrase,
  // getStoredKeyPairs,
} from '../../../services/keyPairService';

import AppInput from '../../../components/ui/AppInput.vue';
// import AppButton from '../../../components/ui/AppButton.vue';
// import AppSwitch from '../../../components/ui/AppSwitch.vue';

/* Props */
const props = defineProps<{ encryptPassword: string }>();

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const createTooltips = useCreateTooltips();

/* State */
const nickname = ref('');

// const advancedMode = ref(false);
const index = ref(0);
const passPhrase = ref('');

const privateKey = ref('');
const publicKey = ref('');

const keyExists = ref(false);

/* Misc Functions */
const validateExistingKey = () => {
  if (
    keyPairsStore.keyPairs.some(kp => kp.public_key === publicKey.value && kp.private_key !== '')
  ) {
    keyExists.value = true;
  } else {
    keyExists.value = false;
  }
};

/* Handlers */
const handleRestoreKey = async () => {
  try {
    const restoredPrivateKey = await restorePrivateKey(
      keyPairsStore.recoveryPhraseWords,
      passPhrase.value,
      index.value,
      'ED25519',
    );

    privateKey.value = restoredPrivateKey.toStringRaw();
    publicKey.value = restoredPrivateKey.publicKey.toStringRaw();

    validateExistingKey();
  } catch {
    toast.error('Invalid recovery phrase', { position: 'bottom-right' });
  }
};

const handleSaveKey = async () => {
  if (privateKey.value) {
    try {
      const secretHash = await hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);

      const keyPair: KeyPair = {
        id: '',
        user_id: user.data.id,
        index: index.value,
        public_key: publicKey.value,
        private_key: privateKey.value,
        organization_id: null,
        secret_hash: secretHash,
        nickname: nickname.value || null,
      };

      await keyPairsStore.storeKeyPair(keyPair, props.encryptPassword);
      user.data.secretHashes = [...user.data.secretHashes, secretHash];

      toast.success('Key Pair saved successfully', {
        position: 'bottom-right',
      });
    } catch (err: any) {
      let message = 'Failed to store key pair';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'bottom-right' });
    }
  }
};

// const handleRestoreExisting = async () => {
//   try {
//     if (!user.data.isLoggedIn) {
//       throw Error('User not logged in!');
//     }

//     const secretHash = await hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);
//     const keyPairsToRestore = (
//       await getStoredKeyPairs(
//         user.data.id,
//         user.data.activeServerURL || '',
//         user.data.activeUserId || '',
//       )
//     ).filter(kp => kp.privateKey === '');

//     await Promise.all(
//       keyPairsToRestore.map(async kp => {
//         const restoredPrivateKey = await restorePrivateKey(
//           keyPairsStore.recoveryPhraseWords,
//           '',
//           kp.index,
//           'ED25519',
//         );

//         if (kp.publicKey === restoredPrivateKey.publicKey.toStringRaw()) {
//           kp.privateKey = restoredPrivateKey.toStringRaw();
//           await keyPairsStore.storeKeyPair(props.encryptPassword, kp, secretHash);
//         }
//       }),
//     );

//     toast.success('Successfully recovered private key/s without passphrase', {
//       position: 'bottom-right',
//     });

//     validateExistingKey();
//   } catch (err: any) {
//     let message = 'Failed to recover private key/s';
//     if (err.message && typeof err.message === 'string') {
//       message = err.message;
//     }
//     toast.error(message, { position: 'bottom-right' });
//   }
// };

/* Hooks */
onMounted(async () => {
  await handleRestoreKey();
});

onUpdated(() => {
  createTooltips();
});

/* Expose */
defineExpose({
  handleSaveKey,
});
</script>
<template>
  <div class="mt-7">
    <!-- <div
      class="mb-5 position-relative"
      v-if="keyPairsStore.keyPairs.some(kp => kp.privateKey === '')"
    >
      <AppButton color="primary" size="small" @click="handleRestoreExisting"
        >Restore existing key pairs</AppButton
      >
      <i
        class="bi bi-info-circle ms-3"
        data-bs-toggle="tooltip"
        data-bs-title="Restore previously saved key pairs with empty passphrase (If you see it after click, you have keys with a passphrase)"
        data-bs-placement="right"
        data-bs-container="body"
      ></i>
    </div> -->
    <div class="form-group mt-5">
      <label class="form-label">Nickname <span class="fw-normal">- Optional</span></label>
      <AppInput v-model="nickname" :filled="true" placeholder="Enter Nickname" />
    </div>
    <div class="form-group w-25 mt-5">
      <label class="form-label">Key Type</label>
      <AppInput model-value="ED25519" readonly />
    </div>
    <!-- <AppSwitch
        v-model:checked="advancedMode"
        size="md"
        name="advanced-mode"
        label="Advanced Option to Restore Key "
        class="mt-5"
      />
      <div v-if="advancedMode" class="mt-5">
        <div class="d-flex row">
          <div class="col-3 col-lg-2">
            <select
              v-model="index"
              class="form-control is-fill form-select rounded-4 py-3 h-100"
              placeholder="Select key index"
            >
              <option v-for="index in [...Array(11).keys()]" :key="index" :value="index">
                {{ index }}
              </option>
            </select>
          </div>
          <div class="col-9 col-lg-6 position-relative d-flex align-items-center">
            <input
              v-model="passPhrase"
              type="passPhrase"
              class="form-control is-fill"
              placeholder="Enter Pass Phrase (optional)"
            />
            <i
              class="bi bi-info-circle position-absolute"
              style="right: 30px"
              data-bs-toggle="tooltip"
              data-bs-title="This is the passphrase for the key itself."
              data-bs-placement="right"
              data-bs-container="body"
            ></i>
          </div>
        </div>
        <div class="mt-5 d-flex row justify-content-center">
          <AppButton color="primary" class="rounded-4 col-12 col-lg-6" @click="handleRestoreKey"
            >Restore Key
          </AppButton>
        </div>
      </div> -->

    <div class="form-group mt-5">
      <label class="form-label">ED25519 Private Key</label>
      <p class="text-break text-secondary">{{ privateKey }}</p>
    </div>
    <div class="form-group mt-4">
      <label class="form-label">ED25519 Public Key</label>
      <p class="text-break text-secondary">{{ publicKey }}</p>
    </div>
    <hr class="my-6" />
    <div class="alert alert-secondary d-flex align-items-start mb-0" role="alert">
      <i class="bi bi-exclamation-triangle text-warning me-3"></i>

      <div>
        <p class="fw-semibold">Sharing Key Pair</p>
        <p>Share this Key Pair from Settings > List of Keys.</p>
      </div>
    </div>

    <!-- <p v-if="keyExists" class="mt-3 text-danger">This key is already restored.</p> -->
    <!-- <div class="d-flex flex-column align-items-center gap-4 mt-8">
      <AppButton
          :disabled="!privateKey || keyExists"
          color="secondary"
          size="large"
          class="rounded-4 col-12 col-lg-6"
          @click="handleSaveKey"
          >Save Key</AppButton
        >
    </div> -->
  </div>
</template>
