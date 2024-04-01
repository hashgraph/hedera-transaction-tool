<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { comparePasswords } from '@renderer/services/userService';
import { restorePrivateKey } from '@renderer/services/keyPairService';
import { getUserState, uploadKey } from '@renderer/services/organization';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import Import from '@renderer/pages/AccountSetup/components/Import.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const step = ref(0);
const ableToContinue = ref(false);

const password = ref('');
const recoveryPhrase = ref([]);
const index = ref(0);
const nickname = ref('');

const inputIndexInvalid = ref(false);
const importRef = ref<InstanceType<typeof Import> | null>(null);

const restoredKey = ref<{ privateKey: string; publicKey: string } | null>(null);

/* Handlers */
const handleFinish = e => {
  e.preventDefault();
  step.value++;
};

const handleEnterPassword = async e => {
  e.preventDefault();

  if (!user.personal?.isLoggedIn) {
    throw new Error('User not found');
  }

  if (!(await comparePasswords(user.personal.id, password.value))) {
    throw new Error('Incorrect password');
  }

  user.recoveryPhrase ? (step.value += 2) : step.value++;
};

const handleRestoreKey = async e => {
  e.preventDefault();

  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase not found');
  }

  try {
    const privateKey = await restorePrivateKey(
      user.recoveryPhrase.words,
      '',
      Number(index.value),
      'ED25519',
    );

    if (
      user.keyPairs.some(
        kp => kp.public_key === privateKey.publicKey.toStringRaw() && kp.public_key !== '',
      )
    ) {
      inputIndexInvalid.value = true;
      return;
    }
    inputIndexInvalid.value = false;

    restoredKey.value = {
      privateKey: privateKey.toStringRaw(),
      publicKey: privateKey.publicKey.toStringRaw(),
    };

    step.value++;
  } catch (err: any) {
    let message = 'Failed to restore privatek key';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  }
};

const handleSaveKey = async e => {
  e.preventDefault();

  if (!user.personal?.isLoggedIn) {
    throw new Error('User not found');
  }

  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase not found');
  }

  if (restoredKey.value) {
    try {
      const keyPair: Prisma.KeyPairUncheckedCreateInput = {
        user_id: user.personal.id,
        index: Number(index.value),
        private_key: restoredKey.value.privateKey,
        public_key: restoredKey.value.publicKey,
        type: 'ED25519',
        organization_id: user.selectedOrganization?.id || null,
        secret_hash: user.recoveryPhrase.hash,
        nickname: nickname.value || null,
      };

      if (isLoggedInOrganization(user.selectedOrganization)) {
        if (
          user.selectedOrganization.userKeys.some(k => k.publicKey === restoredKey.value?.publicKey)
        ) {
          throw new Error('Key pair already exists');
        }

        await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
          publicKey: restoredKey.value.publicKey,
          index: keyPair.index,
          mnemonicHash: user.recoveryPhrase.hash,
        });
      }

      await user.storeKey(keyPair, password.value);

      if (isLoggedInOrganization(user.selectedOrganization)) {
        const userState = await getUserState(
          user.selectedOrganization.serverUrl,
          user.selectedOrganization.userId,
        );
        user.selectedOrganization.isPasswordTemporary = userState.passwordTemporary;
        user.selectedOrganization.secretHashes = userState.secretHashes;
        user.selectedOrganization.userKeys = userState.userKeys;
      }
      user.recoveryPhrase = null;

      toast.success('Key Pair saved', { position: 'bottom-right' });
      router.push({ name: 'settingsKeys' });
    } catch (err: any) {
      let message = 'Failed to store key pair';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'bottom-right' });
    }
  }
};

/* Hooks */
onUnmounted(() => {
  user.recoveryPhrase = null;
});

/* Watchers */
watch(recoveryPhrase, async newRecoveryPhrase => {
  if (!newRecoveryPhrase) {
    ableToContinue.value = false;
  } else if (newRecoveryPhrase.length === 24) {
    try {
      await Mnemonic.fromWords(recoveryPhrase.value || []);
      ableToContinue.value = true;
    } catch {
      ableToContinue.value = false;
    }
  }
});

watch(index, () => {
  inputIndexInvalid.value = false;
});
</script>
<template>
  <div class="flex-column-100 p-8">
    <div class="position-absolute">
      <AppButton color="secondary" @click="$router.back()">Back</AppButton>
    </div>
    <div class="flex-centered flex-column-100">
      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <div v-if="step === 0" class="w-100">
          <h1 class="text-display text-bold text-center">Restore Key Pair</h1>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppButton size="large" color="primary" class="d-block w-100" @click="step++"
                >Continue</AppButton
              >
              <AppButton
                size="large"
                color="secondary"
                class="mt-4 d-block w-100"
                @click="$router.back()"
                >Cancel</AppButton
              >
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <form v-else-if="step === 1" class="w-100" @submit="handleEnterPassword">
          <h1 class="text-display text-bold text-center">Enter password</h1>
          <p class="text-main mt-5 text-center">Please enter new password</p>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppInput
                v-model="password"
                :filled="true"
                type="password"
                placeholder="Enter password"
              />
              <AppButton
                size="large"
                type="submit"
                color="primary"
                class="mt-5 d-block w-100"
                :disabled="password.length === 0"
                >Continue</AppButton
              >
            </div>
          </div>
        </form>

        <!-- Step 3 -->
        <form v-else-if="step === 2" @submit="handleFinish" class="fill-remaining">
          <h1 class="text-display text-bold text-center">Enter your recovery phrase</h1>
          <div class="mt-8">
            <Import
              ref="importRef"
              :handle-continue="handleFinish"
              :secret-hashes="user.secretHashes"
            />
            <div class="row justify-content-between mt-6">
              <div class="col-4 d-grid">
                <AppButton type="button" color="secondary" @click="importRef?.clearWords()"
                  >Clear</AppButton
                >
              </div>
              <div v-if="user.recoveryPhrase" class="col-4 d-grid">
                <AppButton color="primary" :disabled="!user.recoveryPhrase" type="submit"
                  >Continue</AppButton
                >
              </div>
            </div>
          </div>
        </form>

        <!-- Step 4 -->
        <form v-else-if="step === 3" class="w-100" @submit="handleRestoreKey">
          <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
          <p class="text-main mt-5 text-center">Please enter the index of the key</p>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppInput
                v-model="index"
                :filled="true"
                type="number"
                :class="{ 'is-invalid': inputIndexInvalid }"
                placeholder="Enter key index"
              />
              <div v-if="inputIndexInvalid" class="invalid-feedback">
                Key at index {{ index }} is already restored.
              </div>
              <AppButton
                type="submit"
                color="primary"
                class="mt-4 d-block w-100"
                :disabled="index < 0"
                >Continue</AppButton
              >
            </div>
          </div>
        </form>

        <!-- Step 5 -->
        <form v-else-if="step === 4" class="w-100" @submit="handleSaveKey">
          <h1 class="text-display text-bold text-center">Enter nickname</h1>
          <p class="text-main mt-5 text-center">Please enter your nickname (optional)</p>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
              <AppButton type="submit" color="primary" class="mt-4 d-block w-100"
                >Continue</AppButton
              >
            </div>
          </div>
        </form>
      </Transition>
    </div>
  </div>
</template>
