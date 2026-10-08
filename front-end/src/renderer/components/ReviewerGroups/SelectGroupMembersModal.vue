<script setup lang="ts">
import type { Contact } from '@shared/interfaces';

import { computed, nextTick, ref, watch } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Types */
type Selection = { userId: number; userKeyId: number };

/* Props */
const props = defineProps<{
  alreadyAdded?: number[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'confirm', members: Selection[]): void;
}>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* Stores */
const contacts = useContactsStore();

/* State */
const search = ref('');
const expandedUserId = ref<number | null>(null);
const selections = ref<Selection[]>([]);
const listContainer = ref<HTMLElement | null>(null);
const searchInputRef = ref<InstanceType<typeof AppInput> | null>(null);

// Fixed stage height so the list area has a stable, bounded height to scroll within
// regardless of how many contacts are loaded.
const stageStyle = { height: '38rem', maxHeight: '100%', minHeight: '0' };

/* Functions */
const displayName = (contact: Contact) => contact.nickname.trim() || contact.user.email;

/* Computed */
const sortedContacts = computed(() =>
  contacts.contacts
    .filter(c => !(props.alreadyAdded ?? []).includes(c.user.id))
    .slice()
    .sort((a, b) => displayName(a).localeCompare(displayName(b))),
);

/* Handlers */
const isSelected = (userId: number) => selections.value.some(s => s.userId === userId);

const selectionFor = (userId: number) => selections.value.find(s => s.userId === userId)?.userKeyId ?? null;

const keysFor = (userId: number) => contacts.getContact(userId)?.userKeys ?? [];

// After expanding a row, scroll down just enough to reveal its key list — but never
// past the point where the user's own row would scroll above the top of the list.
const scrollToRevealExpanded = (userId: number) => {
  nextTick(() => {
    const container = listContainer.value;
    const wrapper = container?.querySelector(`[data-user-row-id="${userId}"]`);
    if (!container || !wrapper) return;

    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    const maxScrollDown = Math.max(0, wrapperRect.top - containerRect.top);
    const neededScrollDown = wrapperRect.bottom - containerRect.bottom;
    const scrollBy = Math.max(0, Math.min(neededScrollDown, maxScrollDown));

    if (scrollBy > 0) {
      container.scrollBy({ top: scrollBy, behavior: 'smooth' });
    }
  });
};

const handleRowClick = (userId: number) => {
  if (expandedUserId.value === userId) {
    // Clicking the currently-expanded row just collapses it, whether or not a key
    // was picked — it never deselects.
    expandedUserId.value = null;
    return;
  }

  if (isSelected(userId)) {
    // A different, already-selected row — deselect it and collapse whichever row
    // is currently expanded.
    selections.value = selections.value.filter(s => s.userId !== userId);
    expandedUserId.value = null;
    return;
  }

  // The store already holds each contact's keys from the initial load, so they render
  // immediately. This just kicks off a background refresh (not awaited, no loading
  // state) in case a key was registered since then.
  expandedUserId.value = userId;
  void contacts.fetchUserKeys(userId);
  scrollToRevealExpanded(userId);
};

const handleKeySelect = (userId: number, userKeyId: number) => {
  // Selecting a key does not collapse the row — it stays open until a different
  // user is selected (or this row is clicked again) so the choice can still be changed.
  selections.value = [...selections.value.filter(s => s.userId !== userId), { userId, userKeyId }];
};

const handleConfirm = () => {
  if (selections.value.length === 0) return;
  emit('confirm', selections.value);
  show.value = false;
};

const handleCancel = () => {
  show.value = false;
};

/* Watch */
// Search never filters the list — it scrolls to the closest alphabetical match so the
// list's ordering (and everyone's expand/select state) stays stable while typing.
watch(search, value => {
  const query = value.trim().toLowerCase();
  if (!query) return;

  const list = sortedContacts.value;
  const match =
    list.find(c => displayName(c).toLowerCase().startsWith(query)) ??
    list.find(c => displayName(c).toLowerCase().includes(query));

  if (match) {
    nextTick(() => {
      const container = listContainer.value;
      const el = container?.querySelector(`[data-user-row-id="${match.user.id}"]`);
      if (!container || !el) return;

      // Align the match to the top of the list. If it's near the end and the
      // container can't scroll that far, the browser clamps scrollTop for us —
      // that's the "best effort" fallback, no manual clamping needed.
      const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTop += offset;
    });
  }
});

// AppModal keeps this component mounted and just toggles visibility — so state has to
// be reset explicitly each time the modal reopens rather than relying on a fresh mount.
watch(
  show,
  isShown => {
    if (isShown) {
      search.value = '';
      expandedUserId.value = null;
      selections.value = [];
      nextTick(() => searchInputRef.value?.inputRef?.focus());
    }
  },
  { immediate: true },
);
</script>
<template>
  <AppModal v-model:show="show" class="medium-modal">
    <div class="p-4 flex-column-100" :style="stageStyle">
      <div>
        <i
          class="bi bi-x-lg cursor-pointer"
          data-testid="button-close-select-members-modal"
          @click="handleCancel"
        ></i>
      </div>
      <h1 class="text-title text-semi-bold text-center">Select Members</h1>
      <p class="text-secondary text-small text-center mt-2">
        Select a user, then choose their reviewing key.
      </p>

      <div class="mt-5">
        <AppInput
          ref="searchInputRef"
          v-model="search"
          filled
          placeholder="Search"
          data-testid="input-select-members-search"
        />
      </div>

      <hr class="separator my-5" />

      <div ref="listContainer" class="fill-remaining">
        <template v-if="sortedContacts.length > 0">
          <template v-for="contact in sortedContacts" :key="contact.user.id">
            <div :data-user-row-id="contact.user.id" class="mt-3">
              <AppListItem
                :selected="isSelected(contact.user.id)"
                :data-testid="`div-select-member-${contact.user.id}`"
                @click="handleRowClick(contact.user.id)"
              >
                <div class="d-flex justify-content-between align-items-center">
                  <span class="text-nowrap text-truncate">{{ displayName(contact) }}</span>
                  <span v-if="isSelected(contact.user.id)" class="bi bi-check-lg text-success"></span>
                </div>
              </AppListItem>

              <div v-if="expandedUserId === contact.user.id" class="ps-4 mt-2">
                <template v-if="keysFor(contact.user.id).length > 0">
                  <AppListItem
                    v-for="key in keysFor(contact.user.id)"
                    :key="key.id"
                    :selected="selectionFor(contact.user.id) === key.id"
                    class="mt-2"
                    :data-testid="`div-select-member-key-${key.id}`"
                    @click="handleKeySelect(contact.user.id, key.id)"
                  >
                    <span class="text-nowrap text-truncate">{{ key.publicKey }}</span>
                  </AppListItem>
                </template>
                <p v-else class="text-muted text-small">This user has no registered keys</p>
              </div>
            </div>
          </template>
        </template>
        <template v-else>
          <div class="flex-centered flex-column h-100">
            <p class="text-muted">There are no selectable users</p>
          </div>
        </template>
      </div>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton color="borderless" type="button" data-testid="button-select-members-cancel" @click="handleCancel">
          Cancel
        </AppButton>
        <AppButton
          color="primary"
          type="button"
          data-testid="button-select-members-done"
          :disabled="selections.length === 0"
          @click="handleConfirm"
        >
          Select
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
<style scoped>
/* Keep only the member list scrolling within its fixed stage, not the whole modal body.
   Scoped to .medium-modal to avoid also reaching the unrelated small-modal progress
   dialogs AppModal is used for elsewhere. */
.medium-modal :deep(.modal-content) {
  min-height: 0;
}

.medium-modal :deep(.modal-body) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
</style>
