<script setup lang="ts">
import { ref } from 'vue';

import { IKeyPair } from '../../../../main/shared/interfaces/IKeyPair';

import { restorePrivateKey } from '../../../services/keyPairService';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';
import AppSwitch from '../../../components/ui/AppSwitch.vue';

const props = defineProps<{
  encryptPassword: string;
  handleContinue: () => void;
}>();

const keyPairsStore = useKeyPairsStore();

const nickname = ref('');

const advancedMode = ref(false);
const index = ref(0);
const passPhrase = ref('');

const privateKey = ref('');
const publicKey = ref('');

const keyExists = ref(false);
const isSuccessModalShown = ref(false);

const handleRestoreKey = async () => {
  const restoredPrivateKey = await restorePrivateKey(
    keyPairsStore.recoveryPhraseWords,
    passPhrase.value,
    index.value,
    'ED25519',
  );

  if (
    keyPairsStore.keyPairs.some(kp => kp.publicKey === restoredPrivateKey.publicKey.toStringRaw())
  ) {
    keyExists.value = true;
  } else {
    keyExists.value = false;
  }

  privateKey.value = restoredPrivateKey.toStringRaw();
  publicKey.value = restoredPrivateKey.publicKey.toStringRaw();
};

const handleSaveKey = async () => {
  if (privateKey.value) {
    const keyPair: IKeyPair = {
      index: index.value,
      privateKey: privateKey.value,
      publicKey: publicKey.value,
    };

    if (nickname.value) {
      keyPair.nickname = nickname.value;
    }

    await keyPairsStore.storeKeyPair(props.encryptPassword, keyPair);

    isSuccessModalShown.value = true;
  }
};
</script>
<template>
  <div class="mt-8 d-flex flex-column justify-content-center align-items-center gap-4">
    <div class="col-12 col-md-10 col-xxl-8">
      <input
        v-model="nickname"
        type="text"
        class="form-control rounded-4"
        placeholder="Enter Nickname (optional)"
      />
      <AppSwitch
        v-model:checked="advancedMode"
        size="md"
        name="advanced-mode"
        label="Advanced Option to Restore Key "
        class="mt-5"
      />
      <div v-if="advancedMode" class="d-flex row">
        <div class="col-2">
          <select
            v-model="index"
            class="form-control form-select rounded-4 py-3 h-100"
            placeholder="Select key index"
          >
            <option v-for="index in [...Array(11).keys()]" :key="index" :value="index">
              {{ index }}
            </option>
          </select>
        </div>
        <div class="col-10">
          <input
            v-model="passPhrase"
            type="passPhrase"
            class="form-control rounded-4"
            placeholder="Enter Pass Phrase (optional)"
          />
        </div>
      </div>
      <div class="form-group mt-5">
        <label class="form-label">ED25519 Private Key</label>
        <textarea
          :value="privateKey"
          rows="2"
          type="text"
          class="form-control"
          readonly
          placeholder="Private Key"
        ></textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label">ED25519 Public Key</label>
        <textarea
          :value="publicKey"
          rows="2"
          type="text"
          class="form-control"
          readonly
          placeholder="Public Key"
        ></textarea>
      </div>
      <p v-if="keyExists" class="mt-3 text-danger">This key is already restored.</p>
      <div class="w-100 d-flex justify-content-center gap-4 mt-7">
        <AppButton color="primary" class="rounded-4 min-w-50" @click="handleRestoreKey"
          >Restore Key
        </AppButton>
        <AppButton
          :disabled="!privateKey || keyExists"
          color="secondary"
          class="rounded-4 min-w-50"
          @click="handleSaveKey"
          >Save Key</AppButton
        >
      </div>
    </div>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-circle-fill extra-large-icon"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Key Pair saved successfully</h3>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="handleContinue()"
          >Continue</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
