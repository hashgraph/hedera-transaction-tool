<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';
import { Key, KeyList } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { ableToSign, getAccountIdWithChecksum, isUserLoggedIn } from '@renderer/utils';

import SignatureStatusKeyStructure from '@renderer/components/SignatureStatusKeyStructure.vue';

/* Props */
const props = defineProps<{
  entities:
    | {
        [entityId: string]: Key;
      }
    | Key[];
  publicKeysSigned: string[];
  label: string;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const labelParts = computed(() => props.label.split('$entityId'));

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  linkedAccounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});
</script>
<template>
  <template v-for="([entityId, key], _index) in Object.entries(entities)" :key="_index">
    <div class="mt-2">
      <div class="d-flex position-relative text-nowrap">
        <span
          v-if="ableToSign(publicKeysSigned, key)"
          class="bi bi-check-lg text-success position-absolute"
          :style="{ left: '-15px' }"
        ></span>
        <h2
          v-if="label.trim()"
          class="text-small mb-2"
          :class="{ 'text-success': ableToSign(publicKeysSigned, key) }"
        >
          <template v-if="Array.isArray(entities)">
            {{ label.trim() }}
          </template>
          <template v-else>
            <template v-if="label.includes('$entityId')">
              <template v-for="(part, index) in labelParts" :key="index">
                <template v-if="index === labelParts.length - 1">
                  {{ part }}
                </template>
                <template v-else>
                  <span>{{ part }}</span>
                  <span>
                    <template
                      v-if="
                        (linkedAccounts.find(la => la.account_id === entityId)?.nickname || '')
                          .length > 0
                      "
                    >
                      <span>
                        <span class="text-small">
                          {{ linkedAccounts.find(la => la.account_id === entityId)?.nickname }}
                          ({{ getAccountIdWithChecksum(entityId) }})
                        </span>
                      </span>
                    </template>
                    <template v-else>
                      <span class="text-small overflow-hidden">
                        {{ getAccountIdWithChecksum(entityId) || entityId }}
                      </span>
                    </template>
                  </span>
                </template>
              </template>
            </template>
            <template v-else>
              {{ label.trim() }}
            </template>
          </template>
        </h2>
      </div>

      <div class="ms-5">
        <SignatureStatusKeyStructure
          :keyList="key instanceof KeyList ? key : new KeyList([key])"
          :public-keys-signed="publicKeysSigned"
          :depth="0"
        />
      </div>
    </div>
  </template>
</template>
