<script setup lang="ts">
/* Props */
import { computed, ref } from 'vue';
import { ToastManager } from '@renderer/utils/ToastManager.js';
import { PublicKey } from '@hiero-ledger/sdk';

import { CommonNetwork } from '@shared/enums';

import usePersonalPassword from '@renderer/composables/usePersonalPassword.js';
import useUserStore from '@renderer/stores/storeUser.js';
import useNetworkStore from '@renderer/stores/storeNetwork.js';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import { assertUserLoggedIn, getAccountIdWithChecksum } from '@renderer/utils';
import { decryptPrivateKey } from '@renderer/services/keyPairService.js';
import type { KeyInfo } from '@renderer/composables/useKeyManager';

const props = defineProps<{
  keyInfo: KeyInfo;
  checked: boolean;
  enableDelete: boolean;
  rowIndex: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:checked', keyInfo: KeyInfo): void;
  (event: 'delete', keyInfo: KeyInfo): void;
  (event: 'restore', keyInfo: KeyInfo): void;
  (event: 'reconcile', keyInfo: KeyInfo): void;
  (event: 'editNickname', keyPairId: string): void;
}>();

/* Injected */
const toastManager = ToastManager.inject();

/* Composables */
const { getPasswordAsync } = usePersonalPassword();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const decryptedKey = ref<string | null>(null);

/* Computed */
const keyIndexCell = computed(() => {
  let result: string;
  if (props.keyInfo.index() !== -1) {
    result = props.keyInfo.index().toString();
  } else {
    result = 'N/A';
  }
  return result;
});
const accountCell = computed(() => {
  const accountInfos =
    user.publicKeyToAccounts.find(acc => acc.publicKey === props.keyInfo.publicKey)?.accounts ?? [];
  const accountId = accountInfos[0]?.account;
  return accountId ? getAccountIdWithChecksum(accountId) : 'N/A';
});
const keyTypeCell = computed(() => {
  let result: string;
  try {
    const pk = PublicKey.fromString(props.keyInfo.publicKey);
    switch (pk._key._type) {
      case 'secp256k1':
        result = 'ECDSA';
        break;
      case 'ED25519':
        result = 'ED25519';
        break;
      default:
        result = pk._key._type;
        break;
    }
  } catch {
    result = '?';
  }

  return result;
});

/* Handlers */

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toastManager.success(message);
};

const handleShowPrivateKey = async () => {
  const pp = await getPasswordAsync({
    subHeading: 'Enter your application password to decrypt your key',
  });
  if (pp === false) return; // User cancelled action
  if (props.keyInfo.keyPair?.private_key) {
    try {
      assertUserLoggedIn(user.personal);
      decryptedKey.value = await decryptPrivateKey(
        user.personal.id,
        pp,
        props.keyInfo.publicKey,
      );
    } catch {
      toastManager.error('Failed to decrypt private key');
    }
  }
};
</script>

<template>
  <tr :class="props.keyInfo.isMaintenanceRequired() ? 'disabled-w-action' : null">
    <td>
      <AppCheckBox
        :checked="checked"
        @update:checked="emit('update:checked', props.keyInfo)"
        name="select-card"
        :data-testid="'checkbox-multiple-keys-id-' + props.rowIndex"
        class="cursor-pointer d-flex justify-content-center"
      />
    </td>
    <td :data-testid="`cell-index-${props.rowIndex}`" class="text-center">
      {{ keyIndexCell }}
    </td>
    <td :data-testid="`cell-nickname-${props.rowIndex}`">
      <span v-if="props.keyInfo.keyPair !== null">
        <span
          class="bi bi-pencil-square text-main text-primary me-3 cursor-pointer"
          data-testid="button-change-key-nickname"
          @click="emit('editNickname', props.keyInfo.keyPair.id)"
        ></span>
        {{ props.keyInfo.keyPair.nickname || 'N/A' }}
      </span>
    </td>
    <td :data-testid="`cell-account-${props.rowIndex}`">
      <span
        :class="{
          'text-mainnet': network.network === CommonNetwork.MAINNET,
          'text-testnet': network.network === CommonNetwork.TESTNET,
          'text-previewnet': network.network === CommonNetwork.PREVIEWNET,
          'text-info': ![
            CommonNetwork.MAINNET,
            CommonNetwork.TESTNET,
            CommonNetwork.PREVIEWNET,
          ].includes(network.network),
        }"
      >
        {{ accountCell }}
      </span>
    </td>
    <td :data-testid="`cell-key-type-${props.rowIndex}`">
      {{ keyTypeCell }}
    </td>
    <td>
      <p class="d-flex text-nowrap">
        <span
          :data-testid="`span-public-key-${props.rowIndex}`"
          class="d-inline-block text-truncate"
          style="width: 12vw"
          >{{ props.keyInfo.publicKey }}</span
        >
        <span
          :data-testid="`span-copy-public-key-${props.rowIndex}`"
          class="bi bi-copy cursor-pointer ms-3"
          @click="handleCopy(props.keyInfo.publicKey, 'Public Key copied successfully')"
        ></span>
      </p>
    </td>
    <td>
      <p class="d-flex text-nowrap">
        <template v-if="props.keyInfo.keyPair === null"
          ><span class="text-secondary">To be re-imported</span></template
        >
        <template v-else-if="decryptedKey !== null">
          <span
            :data-testid="`span-private-key-${props.rowIndex}`"
            class="d-inline-block text-truncate"
            style="width: 12vw"
            >{{ decryptedKey }}</span
          >
          <span
            :data-testid="`span-copy-private-key-${props.rowIndex}`"
            class="bi bi-copy cursor-pointer ms-3"
            @click="handleCopy(decryptedKey, 'Private Key copied successfully')"
          ></span>
          <span
            :data-testid="`span-hide-private-key-${props.rowIndex}`"
            class="bi bi-eye-slash cursor-pointer ms-3"
            @click="decryptedKey = null"
          ></span>
        </template>
        <template v-else>
          {{ '*'.repeat(16) }}
          <span
            :data-testid="`span-show-modal-${props.rowIndex}`"
            class="bi bi-eye cursor-pointer ms-3"
            @click="handleShowPrivateKey()"
          ></span>
        </template>
      </p>
    </td>
    <td class="text-center text-end">
      <div class="d-flex justify-content-end">
        <AppButton
          v-if="props.keyInfo.keyPair === null"
          size="small"
          color="primary"
          :data-testid="`button-restore-key-${props.rowIndex}`"
          @click="emit('restore', props.keyInfo)"
          class="min-w-unset me-2"
          ><span class="bi bi-arrow-repeat"></span
        ></AppButton>
        <AppButton
          v-if="props.keyInfo.userKey === null"
          size="small"
          color="primary"
          :data-testid="`button-reconcile-key-${props.rowIndex}`"
          @click="emit('reconcile', props.keyInfo)"
          class="min-w-unset me-2"
          ><span class="bi bi-upload"></span
        ></AppButton>
        <AppButton
          size="small"
          color="danger"
          :data-testid="`button-delete-key-${props.rowIndex}`"
          @click="emit('delete', props.keyInfo)"
          class="min-w-unset"
          :class="props.enableDelete ? null : 'invisible'"
          ><span class="bi bi-trash"></span
        ></AppButton>
      </div>
    </td>
  </tr>
</template>
