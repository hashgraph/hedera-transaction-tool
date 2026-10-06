<script setup lang="ts">
import type { EntityRole } from '@shared/interfaces';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { createReviewerRule } from '@renderer/services/organization';

import { ENTITY_ROLES, ROLE_LABELS, TransactionType, TransactionTypeLabels } from '@shared/interfaces';
import { CommonNetwork, CommonNetworkNames } from '@shared/enums';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  capitalize,
  collapseDotsAndLimitSegments,
  decorateAccountId,
  matchLabelPrefix,
  positionGhostSuffix,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { resolveReviewerSigningKey, signReviewerPayload } from './signReviewerPayload';

/* Props */
const props = defineProps<{ groupId: number }>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* Emits */
const emit = defineEmits<{ (event: 'created'): void }>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Injected */
const toastManager = ToastManager.inject();

// Pinned as the first item in their respective dropdowns — real, selectable values (not
// placeholders), so choosing "no filter" never requires first clearing the field.
const ANY_ROLE_LABEL = 'Any role';
const ANY_TYPE_LABEL = 'Any type';

/* State */
const hederaId = ref('');
// Only updated on blur — entityIdKind (and everything derived from it: entityRoleItems,
// transactionTypeItems) reads this rather than the live hederaId, so filtering
// options as the id is being typed can't wipe out a role/type the user already picked.
const committedEntityId = ref('');
const ruleNetworkInput = ref(CommonNetworkNames[network.network]);
const entityRoleInput = ref(ANY_ROLE_LABEL);
const transactionTypeInput = ref(ANY_TYPE_LABEL);
const activate = ref(false);
const entityIdInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const entityIdChecksumRef = ref<HTMLSpanElement | null>(null);
const isEntityIdFocused = ref(false);

/* Computed */
// A node id is a bare non-negative integer (e.g. "1"); any other entity (account, file,
// topic, token) is addressed as shard.realm.num (e.g. "0.0.1234") — same convention
// sanitizeAccountId (@renderer/utils) uses for account ids specifically, minus its
// checksum-suffix handling, which doesn't apply to node/file/topic/token ids.
const HEDERA_NODE_ID_PATTERN = /^\d+$/;
const HEDERA_ENTITY_ID_PATTERN = /^\d+\.\d+\.\d+$/;
const isValidHederaId = (value: string) =>
  HEDERA_NODE_ID_PATTERN.test(value) || HEDERA_ENTITY_ID_PATTERN.test(value);

// Keystroke-level sanitize: digits and dots only, then the same dot-collapsing/
// segment-limit rule sanitizeAccountId itself uses.
function sanitizeHederaId(value: string): string {
  return collapseDotsAndLimitSegments(value.replace(/[^0-9.]/g, ''));
}

const hederaIdModel = computed({
  get: () => hederaId.value,
  set: (value: string) => {
    hederaId.value = sanitizeHederaId(value);
  },
});

// Non-editable checksum suffix, same idea as AppAutoComplete's own postfix ghost text
// (decorateAccountId is the same helper AccountIdInput/AppAutoComplete use), shown only
// for a real shard.realm.num id — a node id (bare integer) has no checksum of its own;
// decorateAccountId would still compute one by treating it as shorthand for "0.0.<num>",
// which isn't a real distinction for a reviewer rule and would be misleading here. Hidden
// while actively typing (isEntityIdFocused) since a partial id has no meaningful checksum
// yet, same as "on blur" for AppAutoComplete's own decorate (which only applies once the
// dropdown's closed).
const entityIdChecksum = computed(() => {
  if (isEntityIdFocused.value) return '';
  if (!HEDERA_ENTITY_ID_PATTERN.test(hederaId.value)) return '';
  return decorateAccountId(hederaId.value);
});

// Positions the ghost span right after the real input's rendered text. Font matching is
// handled by the shared .ghost-suffix CSS (styles/_ui-elements.scss), not here.
function positionEntityIdChecksum() {
  const input = entityIdInputRef.value?.inputRef;
  const checksum = entityIdChecksumRef.value;
  if (!input || !checksum) return;

  positionGhostSuffix(input, checksum);
}

// Hedera entity IDs are shard.realm.num (e.g. "0.0.1234"); node IDs are a bare number
// (e.g. "1"). Use that to narrow which entityRole/transactionType values make sense —
// '' (neither pattern matched yet) leaves them unnarrowed, same as an empty id.
const entityIdKind = computed<'account' | 'node' | ''>(() => {
  const value = committedEntityId.value;
  if (HEDERA_NODE_ID_PATTERN.test(value)) return 'node';
  if (HEDERA_ENTITY_ID_PATTERN.test(value)) return 'account';
  return '';
});

const noSanitize = (value: string) => value;

const networkLabels = Object.values(CommonNetwork).map(value => CommonNetworkNames[value]);
const LABEL_TO_NETWORK = new Map(
  Object.values(CommonNetwork).map(value => [CommonNetworkNames[value].toLowerCase(), value]),
);
const ruleNetwork = computed(
  () => LABEL_TO_NETWORK.get(ruleNetworkInput.value.trim().toLowerCase()) ?? '',
);

// AppAutoComplete's strictItems only guarantees the typed text is a valid PREFIX of
// some label at every step — it doesn't mean a full label has actually been reached (or
// accepted via Tab/Enter/click) yet. entityRole stays '' until "Any role" or a real role
// label has actually been matched (see isResolved/canSubmit below) — '' here covers both
// "nothing valid typed yet" and the legitimate "Any role" selection, since both send the
// same null entityRole in the payload.
const entityRoleLabels = [
  { label: ANY_ROLE_LABEL, value: '' as const },
  ...ENTITY_ROLES.map(role => ({ label: capitalize(ROLE_LABELS[role]), value: role })),
];
const LABEL_TO_ROLE = new Map(entityRoleLabels.map(r => [r.label.toLowerCase(), r.value]));
const entityRole = computed<EntityRole | ''>(
  () => LABEL_TO_ROLE.get(entityRoleInput.value.trim().toLowerCase()) ?? '',
);

const entityRoleItems = computed<string[]>(() => {
  if (entityIdKind.value === 'node') {
    return [capitalize(ROLE_LABELS.node)];
  }

  const roles =
    entityIdKind.value === 'account' ? ENTITY_ROLES.filter(role => role !== 'node') : ENTITY_ROLES;

  return [
    ANY_ROLE_LABEL,
    ...roles.map(role => capitalize(ROLE_LABELS[role])).sort((a, b) => a.localeCompare(b)),
  ];
});

// Same deal as entityRole above — transactionType stays '' until "Any type" or a real
// type label has actually been matched.
const transactionTypeLabels: { label: string; value: TransactionType | '' }[] = [
  { label: ANY_TYPE_LABEL, value: '' },
  ...Object.values(TransactionType)
    .map(type => ({ label: TransactionTypeLabels[type], value: type }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];
const LABEL_TO_TRANSACTION_TYPE = new Map(
  transactionTypeLabels.map(t => [t.label.toLowerCase(), t.value]),
);

// A node only takes NodeUpdate/NodeDelete — NodeCreate has no existing node id to
// target, and NodeStakeUpdate isn't reviewer-relevant.
const NODE_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.NODEUPDATE,
  TransactionType.NODEDELETE,
]);

// Sender/receiver only exist as literal fields on a handful of transaction bodies:
// CryptoTransfer and TokenAirdrop both carry NftTransfer entries (senderAccountID/
// receiverAccountID), and TokenClaimAirdrop/TokenCancelAirdrop address a pending airdrop
// via PendingAirdropId (sender_id/receiver_id). Allowance transactions look similar but
// use owner/spender instead, so they're deliberately excluded here.
const SENDER_RECEIVER_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.CRYPTOTRANSFER,
  TransactionType.TOKENAIRDROP,
  TransactionType.TOKENCLAIMAIRDROP,
  TransactionType.TOKENCANCELAIRDROP,
]);

// "Account" covers the account being targeted — as opposed to the fee payer, or the
// sender/receiver legs of a transfer — per EntityRole.ACCOUNT's own definition: the account
// updated in AccountUpdate (accountIDToUpdate), the account deleted in AccountDelete
// (deleteAccountID), or the account associated with a node in NodeCreate/NodeUpdate
// (account_id). CryptoCreate has no existing account id to target, and allowance
// transactions use owner/spender rather than a plain account field, so both are excluded.
const ACCOUNT_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.CRYPTOUPDATEACCOUNT,
  TransactionType.CRYPTODELETE,
  TransactionType.NODECREATE,
  TransactionType.NODEUPDATE,
]);

// A file id is only a literal field (fileID) on Append/Delete/Update — FileCreate has no
// existing file id to target, same reasoning as NodeCreate above.
const FILE_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.FILEAPPEND,
  TransactionType.FILEDELETE,
  TransactionType.FILEUPDATE,
]);

// A topic id is only a literal field (topicID) on Update/Delete/SubmitMessage —
// ConsensusCreateTopic has no existing topic id to target.
const TOPIC_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.CONSENSUSUPDATETOPIC,
  TransactionType.CONSENSUSDELETETOPIC,
  TransactionType.CONSENSUSSUBMITMESSAGE,
]);

// Every Token Service transaction carries a token id — either a direct `token`/`token_id`
// field, or (for Associate/Dissociate) a repeated token list, or (for Airdrop/Claim/Cancel/
// Reject) a token id nested in each transfer/reference entry. TokenCreate is the one
// exception, since it has no existing token id to target.
const TOKEN_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.TOKENASSOCIATE,
  TransactionType.TOKENAIRDROP,
  TransactionType.TOKENBURN,
  TransactionType.TOKENCANCELAIRDROP,
  TransactionType.TOKENCLAIMAIRDROP,
  TransactionType.TOKENDELETION,
  TransactionType.TOKENDISSOCIATE,
  TransactionType.TOKENFEESCHEDULEUPDATE,
  TransactionType.TOKENFREEZE,
  TransactionType.TOKENGRANTKYC,
  TransactionType.TOKENMINT,
  TransactionType.TOKENPAUSE,
  TransactionType.TOKENREJECT,
  TransactionType.TOKENREVOKEKYC,
  TransactionType.TOKENUNFREEZE,
  TransactionType.TOKENUNPAUSE,
  TransactionType.TOKENUPDATE,
  TransactionType.TOKENUPDATENFTS,
  TransactionType.TOKENWIPE,
]);

// Narrows the Transaction Type dropdown once a role is picked whose entity kind maps to
// only a subset of transaction types — keyed by role rather than entityIdKind since these
// roles describe a field's function within the transaction, not the typed entity's kind.
const ROLE_TRANSACTION_TYPES: Partial<Record<EntityRole, Set<TransactionType>>> = {
  sender: SENDER_RECEIVER_TRANSACTION_TYPES,
  receiver: SENDER_RECEIVER_TRANSACTION_TYPES,
  account: ACCOUNT_TRANSACTION_TYPES,
  file: FILE_TRANSACTION_TYPES,
  token: TOKEN_TRANSACTION_TYPES,
  topic: TOPIC_TRANSACTION_TYPES,
};

const transactionTypeItems = computed(() => {
  const allowedTypes =
    entityIdKind.value === 'node'
      ? NODE_TRANSACTION_TYPES
      : (entityRole.value && ROLE_TRANSACTION_TYPES[entityRole.value]) || null;

  return [
    ANY_TYPE_LABEL,
    ...transactionTypeLabels
      .filter(t => t.value && (!allowedTypes || allowedTypes.has(t.value)))
      .map(t => t.label),
  ];
});

const transactionType = computed<TransactionType | ''>(
  () => LABEL_TO_TRANSACTION_TYPE.get(transactionTypeInput.value.trim().toLowerCase()) ?? '',
);

// "Any role"/"Any type" are themselves real, resolvable items (mapping to '' same as an
// unmatched input), so canSubmit can't tell those apart from "nothing valid typed yet" by
// checking for a non-empty resolved value the way it can for network. Check against the
// label maps directly instead — true for any fully-matched label, Any-sentinel or not.
const isResolved = (map: Map<string, unknown>, input: string) => map.has(input.trim().toLowerCase());

const canSubmit = computed(
  () =>
    isValidHederaId(hederaId.value) &&
    isResolved(LABEL_TO_NETWORK, ruleNetworkInput.value) &&
    isResolved(LABEL_TO_ROLE, entityRoleInput.value) &&
    isResolved(LABEL_TO_TRANSACTION_TYPE, transactionTypeInput.value),
);

/* Handlers */
const handleEntityIdFocus = () => {
  isEntityIdFocused.value = true;
};

const handleEntityIdBlur = () => {
  committedEntityId.value = hederaId.value.trim();
  isEntityIdFocused.value = false;
};

const handleSubmitClick = () => {
  if (!canSubmit.value) return;
  activate.value = true;
};

const handleCreate = async (personalPassword: string | null): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const signingKey = resolveReviewerSigningKey(user.keyPairs, user.selectedOrganization.userKeys);
  if ('title' in signingKey) return signingKey;

  const rulePayload = {
    hederaId: hederaId.value.trim(),
    network: ruleNetwork.value,
    entityRole: entityRole.value || null,
    transactionType: transactionType.value || null,
  };

  const { userKeyId, userSignature } = await signReviewerPayload(
    user.personal.id,
    personalPassword,
    signingKey.orgKeyId,
    signingKey.orgKeyPublicKey,
    rulePayload,
  );

  await createReviewerRule(user.selectedOrganization.serverUrl, {
    groupId: props.groupId,
    hederaId: rulePayload.hederaId,
    network: rulePayload.network,
    entityRole: rulePayload.entityRole ?? undefined,
    transactionType: rulePayload.transactionType ?? undefined,
    userKeyId,
    userSignature,
  });

  toastManager.success('Reviewer rule added successfully');
  emit('created');
  show.value = false;

  return null;
};

/* Watch */
watch(show, isShown => {
  if (isShown) {
    hederaId.value = '';
    committedEntityId.value = '';
    ruleNetworkInput.value = CommonNetworkNames[network.network];
    entityRoleInput.value = ANY_ROLE_LABEL;
    transactionTypeInput.value = ANY_TYPE_LABEL;
  }
});

watch(entityIdKind, kind => {
  if (kind === 'node') {
    entityRoleInput.value = capitalize(ROLE_LABELS.node);
    if (transactionType.value && !NODE_TRANSACTION_TYPES.has(transactionType.value)) {
      transactionTypeInput.value = ANY_TYPE_LABEL;
    }
  } else if (entityRole.value === 'node') {
    entityRoleInput.value = ANY_ROLE_LABEL;
  }
});

watch(entityRole, role => {
  const allowedTypes = role && ROLE_TRANSACTION_TYPES[role];
  if (allowedTypes && transactionType.value && !allowedTypes.has(transactionType.value)) {
    transactionTypeInput.value = ANY_TYPE_LABEL;
  }
});

// Repositions whenever the ghost text itself changes (appears/disappears/changes length)
// — covers both the focus/blur transition and the id changing while blurred.
watch(entityIdChecksum, () => nextTick(positionEntityIdChecksum));

/* Hooks */
onMounted(() => window.addEventListener('resize', positionEntityIdChecksum));
onBeforeUnmount(() => window.removeEventListener('resize', positionEntityIdChecksum));
</script>
<template>
  <AppModal v-model:show="show" :close-on-click-outside="false" class="medium-modal">
    <div class="p-4">
      <form @submit.prevent="handleSubmitClick">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Add Rule</h1>
        <hr class="separator my-5" />

        <div class="form-group">
          <label class="form-label">Entity or Node ID</label>
          <div class="ghost-suffix-wrapper">
            <AppInput
              ref="entityIdInputRef"
              v-model="hederaIdModel"
              filled
              placeholder="e.g. 0.0.1234 or 1"
              data-testid="input-reviewer-rule-entity-id"
              @focus="handleEntityIdFocus"
              @blur="handleEntityIdBlur"
            />
            <span
              v-if="entityIdChecksum"
              ref="entityIdChecksumRef"
              class="ghost-suffix"
              aria-hidden="true"
              >{{ entityIdChecksum }}</span
            >
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">Network</label>
          <AppAutoComplete
            v-model="ruleNetworkInput"
            :items="networkLabels"
            :sanitize="noSanitize"
            :find-match="matchLabelPrefix"
            strict-items
            filled
            data-testid="input-reviewer-rule-network"
          />
        </div>

        <div class="form-group mt-4">
          <label class="form-label">Entity Role</label>
          <AppAutoComplete
            v-model="entityRoleInput"
            :items="entityRoleItems"
            :sanitize="noSanitize"
            :find-match="matchLabelPrefix"
            strict-items
            filled
            data-testid="input-reviewer-rule-entity-role"
          />
        </div>

        <div class="form-group mt-4">
          <label class="form-label">Transaction Type</label>
          <AppAutoComplete
            v-model="transactionTypeInput"
            :items="transactionTypeItems"
            :sanitize="noSanitize"
            :find-match="matchLabelPrefix"
            strict-items
            filled
            data-testid="input-reviewer-rule-transaction-type"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="show = false">Cancel</AppButton>
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-submit-create-reviewer-rule"
            :disabled="!canSubmit"
          >
            Add Rule
          </AppButton>
        </div>
      </form>
    </div>

    <ActionController
      v-model:activate="activate"
      :action-callback="handleCreate"
      :personal-password-required="true"
      progress-title="Add Reviewer Rule"
      :progress-text="`Adding rule for ${hederaId}`"
      data-testid="action-controller-create-reviewer-rule"
    />
  </AppModal>
</template>
