<script setup lang="ts">
import { computed } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import * as ush from '@renderer/utils/userStoreHelpers';

/* Props */
const props = defineProps<{
  publicKey: PublicKey | string;
  brackets?: boolean;
}>();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* Computed */
const value = computed(() => {
  return props.publicKey instanceof PublicKey ? props.publicKey.toStringRaw() : props.publicKey;
});

const contact = computed(() => contacts.getContactByPublicKey(value.value));

const localKeyPairNickname = computed(() => ush.getNickname(value.value, user.keyPairs));
</script>
<template>
  <span v-if="localKeyPairNickname?.trim() || contact">
    <template v-if="brackets">(</template
    >{{ localKeyPairNickname?.trim() || contact?.nickname.trim() || contact?.user.email
    }}<template v-if="brackets">)</template>
  </span>
</template>
