<script setup lang="ts">
import type { KeyPair } from '@prisma/client';
import type { IUserKey } from '@main/shared/interfaces';
import { Tabs } from '..';

import { computed, ref, watch } from 'vue';

import { RESTORE_MISSING_KEYS } from '@renderer/router';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSelect from '@renderer/components/ui/AppSelect.vue';
import UpdateRecoveryPhraseNickname from '@renderer/components/modals/UpdateRecoveryPhraseNicknameModal.vue';

/* Props */
const props = defineProps<{
  selectedTab: Tabs;
  selectedRecoveryPhrase: string;
  listedKeyPairs: KeyPair[];
  listedMissingKeyPairs: IUserKey[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:selectedTab', value: Tabs): void;
  (event: 'update:selectedRecoveryPhrase', value: string): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const recoveryPhraseNickname = useRecoveryPhraseNickname();

/* State */
const isUpdateRecoveryPhraseNicknameModalShown = ref(false);

/* Computed */
const recoveryPhraseHashes = computed(() => {
  const listedMnemonicHashes = isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.secretHashes
    : user.secretHashes;

  return listedMnemonicHashes.map((hash, i) => ({
    label: recoveryPhraseNickname.get(hash) || `Recovery Phrase ${i + 1}`,
    value: hash,
  }));
});

const missingKeys = computed(() =>
  isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.userKeys.filter(
        key => !user.keyPairs.some(kp => kp.public_key === key.publicKey),
      )
    : [],
);

/* Handlers */
const handleTabChange = (tab: Tabs) => {
  if (props.selectedTab !== tab) {
    emit('update:selectedRecoveryPhrase', '');
    emit('update:selectedTab', tab);
  }
};

const handleRedirectToRecoverMnemonicKeys = () => {
  router.push({ name: RESTORE_MISSING_KEYS });
};

/* Watchers */
watch(
  () => props.selectedRecoveryPhrase,
  newVal => {
    if (newVal) {
      emit('update:selectedTab', Tabs.RECOVERY_PHRASE);
    }
  },
);

watch(
  () => user.selectedOrganization,
  () => handleTabChange(Tabs.ALL),
);

watch(
  [() => props.listedKeyPairs, () => props.listedMissingKeyPairs],
  ([keyPairs, missingKeyPairs]) => {
    if (
      keyPairs.length === 0 &&
      missingKeyPairs.length === 0 &&
      props.selectedTab === Tabs.RECOVERY_PHRASE
    ) {
      handleTabChange(Tabs.ALL);
    }
  },
);
</script>
<template>
  <div class="btn-group-container d-inline-flex w-100" role="group">
    <div class="btn-group gap-3 overflow-x-auto">
      <!-- All -->
      <AppButton
        :color="selectedTab === Tabs.ALL ? 'primary' : undefined"
        :data-testid="`tab-${Tabs.ALL}`"
        class="rounded-3 text-nowrap min-w-unset"
        :class="{
          active: selectedTab === Tabs.ALL,
          'text-body': selectedTab !== Tabs.ALL,
        }"
        @click="handleTabChange(Tabs.ALL)"
        >{{ Tabs.ALL }}</AppButton
      >

      <!-- Imported from Private Key -->
      <AppButton
        :color="selectedTab === Tabs.PRIVATE_KEY ? 'primary' : undefined"
        :data-testid="`tab-${Tabs.PRIVATE_KEY}`"
        class="rounded-3 text-nowrap min-w-unset"
        :class="{
          active: selectedTab === Tabs.PRIVATE_KEY,
          'text-body': selectedTab !== Tabs.PRIVATE_KEY,
        }"
        @click="handleTabChange(Tabs.PRIVATE_KEY)"
        >{{ Tabs.PRIVATE_KEY }}</AppButton
      >

      <!-- Imported from Recovery Phrase DropDown -->
      <AppSelect
        :value="selectedRecoveryPhrase"
        @update:value="emit('update:selectedRecoveryPhrase', $event)"
        :items="recoveryPhraseHashes"
        :toggle-text="Tabs.RECOVERY_PHRASE"
        :active="selectedTab === Tabs.RECOVERY_PHRASE"
        :color="'primary'"
        button-class="rounded-3"
        class="text-nowrap"
        :style="{ maxWidth: '300px' }"
        toggler-icon
        color-on-active
      />

      <!-- Set/Change Recovery Phrase nickname -->
      <AppButton
        v-if="selectedTab === Tabs.RECOVERY_PHRASE"
        color="secondary"
        :data-testid="`button-change-nickname`"
        class="rounded-3 text-nowrap min-w-unset"
        @click="isUpdateRecoveryPhraseNicknameModalShown = true"
        >{{
          !user.mnemonics.some(m => m.mnemonicHash === selectedRecoveryPhrase) ? 'Set' : 'Change'
        }}
        Recovery Phrase Nickname</AppButton
      >

      <!-- Restore missing keys from recovery phrase -->
      <AppButton
        v-if="
          selectedTab === Tabs.RECOVERY_PHRASE &&
          missingKeys.some(k => k.mnemonicHash === selectedRecoveryPhrase)
        "
        color="primary"
        :data-testid="`button-restore-lost-keys`"
        class="rounded-3 text-nowrap min-w-unset"
        @click="handleRedirectToRecoverMnemonicKeys()"
        >Restore Missing Keys</AppButton
      >
    </div>

    <UpdateRecoveryPhraseNickname
      v-model:show="isUpdateRecoveryPhraseNicknameModalShown"
      :recovery-phrase-hash="selectedRecoveryPhrase"
    />
  </div>
</template>
