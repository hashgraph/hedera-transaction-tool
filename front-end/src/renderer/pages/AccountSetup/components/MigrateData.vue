<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { restorePrivateKey, validateMnemonic } from '@renderer/services/keyPairService';

import { searchEncryptedKeys } from '@renderer/services/encryptedKeys';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  migrateAccountsData,
  getDataMigrationKeysPath,
} from '@renderer/services/migrateDataService';

import { Prisma } from '@prisma/client';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import DecryptKeys from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeys.vue';
import DecryptMnemonicPhrase from '@renderer/components/DataMigration/DecryptMnemonicPhrase.vue';
import useNetworkStore from '@renderer/stores/storeNetwork';

/* Props */
// defineProps<{
//   handleNext: () => void;
// }>();

/* Store */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const addOrganizationModalShown = ref(false);

/* Injected */
const decryptMnemonicPhraseRef = ref<InstanceType<typeof DecryptMnemonicPhrase> | null>(null);

/* State */
const words = ref(Array(24).fill(''));
const decryptMnemonicPhraseShown = ref(false);
const decryptKeysRef = ref<InstanceType<typeof DecryptKeys> | null>(null);

//TODO when this is merged with 'import', a popup will be shown to the user if the migration files
// have been located
/* Handlers */
const handleMigrateData = async () => {
  if (!isUserLoggedIn(user.personal)) throw Error('User is not logged in');

  if (!(await validateMnemonic(words.value))) {
    toast.error('Invalid recovery phrase');
    return;
  }

  const recoveryWords = words.value;
  await user.setRecoveryPhrase(recoveryWords);

    // Automatically create the 0 key pair and save it
  const restoredPrivateKey = await restorePrivateKey(
    recoveryWords,
    '',
    0,
    'ED25519',
  );

  const keyPair: Prisma.KeyPairUncheckedCreateInput = {
    user_id: user.personal.id,
    index: 0,
    public_key: restoredPrivateKey.publicKey.toStringRaw(),
    private_key: restoredPrivateKey.toStringRaw(),
    type: 'ED25519',
    organization_id: null,
    organization_user_id: null,
    secret_hash: user.recoveryPhrase?.hash,
    nickname: null,
  };

  await user.storeKey(
    keyPair,
    recoveryWords,
    user.getPassword(),
    false,
  );

  toast.success('Personal key created successfully');

  addOrganizationModalShown.value = true;
};

const handleAddOrganization = async (organization: Organization) => {
  const thing = user.keyPairs;
  console.log(thing);
  await user.refetchOrganizations();
  // organization.keyPairs = user.keyPairs;
  //org.secrethashes and keypair.secret_hash needs to be set, but even then, temp email still sends it to account setup
  await user.selectOrganization(organization);

  if (!isUserLoggedIn(user.personal)) throw Error('User is not logged in');
  const count = await migrateAccountsData(user.personal.id, network.network)
  if (count) {
    toast.success(`${count} Accounts migrated successfully`);
  } else {
    toast.error('Failed to migrate accounts');
  }
// find the 'use existing key' option
  const keysPath = await getKeysPath();
  const encryptedKeyPaths = await searchEncryptedKeys([keysPath]);
  // this password should start with the one used to decyrpt hte mnemonic
  // leemon might want to skip certain keys, add it to the decrypt thing, shows a list of all keys found
  await decryptKeysRef.value?.process(encryptedKeyPaths || [], words.value);
};

const handleCopyRecoveryPhrase = () => {
  navigator.clipboard.writeText(words.value.join(', '));
  toast.success('Recovery phrase copied');
};

/* wrapped in a function to allow for mocking, and possible future changes allowing user to specify location */
async function getKeysPath() {
  return await getDataMigrationKeysPath();
}

//TODO if the user sits on any of the setup pages for too long, the password will expire
async function loadMnemonic() {
  //TODO would be nice to persist these words so it doesn't need to calculate it every time it comes here
  // would need a store for that
  // import { createStore } from 'vuex';
  //
  // export default createStore({
  //   state: {
  //     recoveryWords: Array(24).fill(''),
  //   },
  //   mutations: {
  //     setRecoveryWords(state, words) {
  //       state.recoveryWords = words;
  //     },
  //     clearRecoveryWords(state) {
  //       state.recoveryWords = Array(24).fill('');
  //     },
  //   },
  //   actions: {
  //     saveRecoveryWords({ commit }, words) {
  //       commit('setRecoveryWords', words);
  //     },
  //     clearRecoveryWords({ commit }) {
  //       commit('clearRecoveryWords');
  //     },
  //   },
  //   getters: {
  //     getRecoveryWords: (state) => state.recoveryWords,
  //   },
  // });

//   then something like this
//   const store = useStore();
//   const words = ref(Array(24).fill(''));
//
// // Watch for changes in `words` and save to Vuex store
//   watch(words, (newWords) => {
//     store.dispatch('saveRecoveryWords', newWords);
//   }, { deep: true });
//
//   onMounted(async () => {
//     const savedWords = store.getters.getRecoveryWords;
//     if (savedWords) {
//       words.value = savedWords;
//     } else {
//       await loadMnemonic();
//     }
//   });
//except instead of unmounted, it would be next? well, I still need to clear it if a different mnemonic flow is chosen
//   onUnmounted(() => {
//     store.dispatch('clearRecoveryWords');
//   });
  if (!(await validateMnemonic(words.value))) {
    if (await locateDataMigrationFiles()) {
      const password = user.getPassword();
      // use the current password to decrypt the mnemonic
      // if that doesn't work, the user will be prompted for a password
      if (password) {
        const decryptedWords = await decryptMigrationMnemonic(password);
        if (decryptedWords) {
          words.value = decryptedWords;
          return;
        }
      }

      decryptMnemonicPhraseShown.value = true;
    } else {
      toast.error('No data migration files found.');
    }
  }
}

const handlePasswordEntered = async (password: string) => {
  const decryptedWords = await decryptMigrationMnemonic(password);
  if (decryptedWords) {
    decryptMnemonicPhraseShown.value = false;
    toast.success('Mnemonic phrase decrypted successfully');
    words.value = decryptedWords;
  } else {
    toast.error('Mnemonic phrase decryption failed. Try a different password.');
  }
};

/* Hooks */
onMounted(async () => {
  await loadMnemonic();
});
</script>
<template>
  <div>
    <div class="row flex-wrap g-12px mx-0">
      <template v-for="(word, index) in words || []" :key="index">
        <AppRecoveryPhraseWord
          class="col-3"
          :word="word"
          :index="index + 1"
          :readonly="true"
          :visible-initially="true"
        />
      </template>
    </div>
    <div
      class="flex-between-centered mt-6"
      v-if="words.filter(w => w).length !== 0">
      <AppButton
        color="secondary"
        data-testid="button-copy"
        @click="handleCopyRecoveryPhrase"
        class="ms-4"
      ><i class="bi bi-copy"></i> <span>Copy</span></AppButton
      >
      <AppButton
        color="primary"
        @click="handleMigrateData"
        data-testid="button-next-import"
        class="right-aligned-button"
      >Next</AppButton
      >
    </div>
    <AddOrganizationModal
      v-if="addOrganizationModalShown"
      v-model:show="addOrganizationModalShown"
      @added="handleAddOrganization"
    />

    <DecryptMnemonicPhrase
      ref="decryptMnemonicPhraseRef"
      v-model:show="decryptMnemonicPhraseShown"
      @passwordEntered="handlePasswordEntered"
    />

    <!-- Step #3: Decrypt Keys -->
    <DecryptKeys  ref="decryptKeysRef" />
  </div>
</template>
