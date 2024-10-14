<script setup lang="ts">
import type { KeyPair } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { getKeyPairs } from '@renderer/services/keyPairService';

import { isUserLoggedIn } from '@renderer/utils';

/* Props */
defineProps<{
  selectedPersonalKeyPair: KeyPair | null;
}>();

/* Emits */
const emit = defineEmits(['update:selectedPersonalKeyPair']);

/* Stores */
const user = useUserStore();

/* State */
const keyPairs = ref<KeyPair[]>([]);

/* Handlers */
const handleSelectKeyPair = (keyPair: KeyPair | null) => {
  emit('update:selectedPersonalKeyPair', keyPair);
};

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  keyPairs.value = await getKeyPairs(user.personal.id, null);
});
</script>
<template>
  <table class="table-custom">
    <thead>
      <tr>
        <th class="w-10 text-end">Index</th>
        <th>Nickname</th>
        <th>Key Type</th>
        <th>Public Key</th>
      </tr>
    </thead>
    <tbody class="text-secondary">
      <template
        v-for="(keyPair, index) in keyPairs.filter(key => key.secret_hash !== null)"
        :key="keyPair.public_key"
      >
        <tr
          class="cursor-pointer"
          @click="handleSelectKeyPair(selectedPersonalKeyPair?.id === keyPair.id ? null : keyPair)"
          :selected="selectedPersonalKeyPair?.id === keyPair.id ? true : undefined"
          hoverable
        >
          <td :data-testid="`cell-index-${index}`" class="text-end">
            {{ keyPair.index >= 0 ? keyPair.index : 'N/A' }}
          </td>
          <td
            :data-testid="`cell-nickname-${index}`"
            class="overflow-hidden"
            style="max-width: 15vw"
          >
            {{ keyPair.nickname || 'N/A' }}
          </td>
          <td :data-testid="`cell-key-type-${index}`">
            {{
              PublicKey.fromString(keyPair.public_key)._key._type === 'secp256k1'
                ? 'ECDSA'
                : 'ED25519'
            }}
          </td>
          <td>
            <p class="d-flex text-nowrap">
              <span
                :data-testid="`span-public-key-${index}`"
                class="d-inline-block text-truncate"
                >{{ keyPair.public_key }}</span
              >
            </p>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
