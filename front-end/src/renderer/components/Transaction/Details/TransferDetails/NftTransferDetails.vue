<script setup lang="ts">
import { computed } from 'vue';
import { AccountId, TokenId, TransferTransaction } from '@hiero-ledger/sdk';
import type { HederaAccount } from '@prisma/client';
import NftSerial from '@renderer/components/Transaction/Details/TransferDetails/NftSerial.vue';
import { getAccountIdWithChecksum } from '@renderer/utils';

/* Props */
const props = defineProps<{
  tokenId: TokenId;
  transaction: TransferTransaction;
  linkedAccounts: HederaAccount[];
}>();

/* Computed */
const nftTransfers = computed(() => {
  const result: {
    sender: AccountId;
    recipient: AccountId;
    serial: Long;
    key: string;
  }[] = [];
  const nftTransfers = props.transaction.nftTransfers.get(props.tokenId);
  if (nftTransfers !== null) {
    for (const t of nftTransfers) {
      result.push({
        sender: t.sender,
        recipient: t.recipient,
        serial: t.serial,
        key: t.sender.toString() + '/' + t.recipient.toString() + '/' + t.serial,
      });
    }
  }
  return result;
});

/* Functions */
const findNickname = (accountId: AccountId) => {
  return props.linkedAccounts.find(la => la.account_id === accountId.toString())?.nickname ?? null;
};
</script>

<template>
  <div class="col-6">
    <div class="mt-3">
      <template v-for="t in nftTransfers" :key="t.key">
        <div class="mt-3">
          <div class="row align-items-center px-3">
            <div
              class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
            >
              <template v-if="findNickname(t.sender) !== null">
                <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                  <p class="text-small text-semi-bold me-2">
                    {{ findNickname(t.sender) }}
                  </p>
                  <p class="text-secondary text-micro overflow-hidden">
                    ({{ getAccountIdWithChecksum(t.sender.toString()) }})
                  </p>
                </div>
              </template>
              <template v-else>
                <p
                  class="text-secondary text-small overflow-hidden"
                  data-testid="p-transfer-from-account-details"
                >
                  {{ getAccountIdWithChecksum(t.sender.toString()) }}
                </p>
              </template>
            </div>
            <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
              <NftSerial :serial="t.serial" :token-id="tokenId" />
            </div>
          </div>
          <hr class="separator" />
        </div>
      </template>
    </div>
  </div>
  <div class="col-6">
    <div class="mt-3">
      <template v-for="t in nftTransfers" :key="t.key">
        <div class="mt-3">
          <div class="row align-items-center px-3">
            <div
              class="col-6 col-lg-5 flex-centered justify-content-start flex-wrap overflow-hidden"
            >
              <template v-if="findNickname(t.recipient) !== null">
                <div class="d-flex align-items-baseline justify-content-start flex-wrap">
                  <p class="text-small text-semi-bold me-2">
                    {{ findNickname(t.recipient) }}
                  </p>
                  <p
                    class="text-secondary text-micro overflow-hidden"
                    data-testid="p-transfer-to-account-details"
                  >
                    ({{ getAccountIdWithChecksum(t.recipient.toString()) }})
                  </p>
                </div>
              </template>
              <template v-else>
                <p
                  class="text-secondary text-small overflow-hidden"
                  data-testid="p-transfer-to-account-details"
                >
                  {{ getAccountIdWithChecksum(t.recipient.toString()) }}
                </p>
              </template>
            </div>
            <div class="col-6 col-lg-7 text-end text-nowrap overflow-hidden">
              <NftSerial :serial="t.serial" :token-id="tokenId" />
            </div>
          </div>
          <hr class="separator" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
