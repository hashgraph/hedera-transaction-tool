<script lang="ts" setup>
import {
  AccountCreateTransaction,
  AccountUpdateTransaction,
  KeyList,
  PublicKey,
} from '@hashgraph/sdk';
import TransactionBrowserSection from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserSection.vue';
import {
  extractIdentifier,
  formatPublicKey,
  getAccountIdWithChecksum,
  stringifyHbar,
} from '@renderer/utils';
import { ref, watch } from 'vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  transaction: AccountCreateTransaction | AccountUpdateTransaction;
}>();

/* State */
const isKeyStructureModalShown = ref(false);
const formattedKey = ref('');

/* Watchers */
watch(
  () => props.transaction,
  async () => {
    if (props.transaction.key && props.transaction.key instanceof PublicKey) {
      formattedKey.value = await formatPublicKey(props.transaction.key.toStringRaw());
    }
  },
);
</script>

<template>
  <TransactionBrowserSection
    v-if="(transaction as AccountUpdateTransaction).accountId"
    :alone="true"
  >
    <template v-slot:label>Memo</template>
    <template v-slot:value>{{
      getAccountIdWithChecksum((transaction as AccountUpdateTransaction).accountId!.toString())
    }}</template>
  </TransactionBrowserSection>

  <TransactionBrowserSection v-if="transaction.key" :alone="true">
    <template v-slot:label>Key</template>
    <template v-slot:value>
      <template v-if="transaction.key instanceof KeyList">
        <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
          >See details</span
        >
      </template>
      <template v-else-if="transaction.key instanceof PublicKey && formattedKey">
        <p class="overflow-hidden">
          <span :class="{ 'text-pink': !extractIdentifier(formattedKey) }" class="text-semi-bold">
            {{ transaction.key._key._type }}
          </span>
          <span v-if="extractIdentifier(formattedKey)" class="d-flex flex-row flex-wrap gap-2">
            <span class="text-small text-pink">{{
              extractIdentifier(formattedKey)?.identifier
            }}</span>
            <span class="text-secondary text-small">{{
              `(${extractIdentifier(formattedKey)?.pk})`
            }}</span>
          </span>
          <span v-else>{{ formattedKey }}</span>
        </p>
      </template>
      <template v-else>None</template>
    </template>
  </TransactionBrowserSection>

  <TransactionBrowserSection
    v-if="transaction.accountMemo !== null && transaction.accountMemo.trim().length > 0"
    :alone="true"
  >
    <template v-slot:label>Memo</template>
    <template v-slot:value>{{ transaction.accountMemo }}</template>
  </TransactionBrowserSection>

  <TransactionBrowserSection
    v-if="
      transaction instanceof AccountCreateTransaction ||
      transaction.stakedNodeId !== null ||
      transaction.stakedAccountId !== null
    "
  >
    <template v-slot:label>Staking</template>
    <template v-slot:value>
      {{
        transaction.stakedAccountId && transaction.stakedAccountId.toString() !== '0.0.0'
          ? `Account ${transaction.stakedAccountId.toString()}`
          : transaction.stakedNodeId && transaction.stakedNodeId.toString()
            ? `Node ${transaction.stakedNodeId.toString()}`
            : transaction instanceof AccountCreateTransaction
              ? 'None'
              : 'Unstaked'
      }}
    </template>
  </TransactionBrowserSection>

  <TransactionBrowserSection
    v-if="
      transaction instanceof AccountUpdateTransaction || transaction.declineStakingRewards !== null
    "
  >
    <template v-slot:label>Accept Staking Rewards</template>
    <template v-slot:value> {{ transaction.declineStakingRewards ? 'No' : 'Yes' }} </template>
  </TransactionBrowserSection>

  <TransactionBrowserSection
    v-if="
      transaction instanceof AccountCreateTransaction ||
      transaction.receiverSignatureRequired !== null
    "
  >
    <template v-slot:label>Receiver Signature Required</template>
    <template v-slot:value> {{ transaction.receiverSignatureRequired ? 'Yes' : 'No' }} </template>
  </TransactionBrowserSection>

  <TransactionBrowserSection v-if="(transaction as AccountCreateTransaction).initialBalance">
    <template v-slot:label>Initial Balance</template>
    <template v-slot:value>{{
      stringifyHbar((transaction as AccountCreateTransaction).initialBalance!)
    }}</template>
  </TransactionBrowserSection>

  <TransactionBrowserSection
    v-if="
      transaction instanceof AccountCreateTransaction ||
      transaction.maxAutomaticTokenAssociations !== null
    "
  >
    <template v-slot:label>Max Automatic Token Associations</template>
    <template v-slot:value> {{ transaction.maxAutomaticTokenAssociations }} </template>
  </TransactionBrowserSection>

  <KeyStructureModal v-model:show="isKeyStructureModalShown" :account-key="transaction.key" />
</template>
