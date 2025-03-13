<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import { isPublicKey, isLoggedInOrganization, findIdentifier } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Enums */
enum KeyTab {
  MY = 'My keys',
  CONTACTS = 'My contacts',
  PUBLIC = 'Public keys',
}

/* Props */
const props = defineProps<{
  show: boolean;
  alreadyAdded?: string[];
  multiple?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'selected:single', publicKey: PublicKey): void;
  (event: 'selected:multiple', publicKeys: PublicKey[]): void;
}>();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* State */
const publicKey = ref('');
const selectedPublicKeys = ref<string[]>([]);
const searchInput = ref('');
const currentTab = ref(KeyTab.MY);
const identifiers = ref<string[]>([]);
const isLoadingIdentifiers = ref(false);

/* Computed */
const myKeys = computed(() => {
  return user.keyPairs.map(kp => ({
    publicKey: kp.public_key,
    nickname: kp.nickname,
  }));
});

const myContactListKeys = computed(() => {
  if (!isLoggedInOrganization(user.selectedOrganization)) return [];
  const myKeySet = new Set(myKeys.value.map(k => k.publicKey));
  return contacts.publicKeys.filter(pk => !myKeySet.has(pk.publicKey));
});

const publicKeysList = computed(() => {
  const myKeySet = new Set(myKeys.value.map(k => k.publicKey));
  // While the public keys shouldn't have the user's own keys, we filter them out just in case
  return user.publicKeyMappings.filter(pk => !myKeySet.has(pk.publicKey));
});

const listedKeyList = computed(() => {
  let result: { publicKey: string; nickname: string | null }[] = [];

  switch (currentTab.value) {
    case KeyTab.MY:
      result = myKeys.value;
      break;
    case KeyTab.CONTACTS:
      result = myContactListKeys.value;
      break;
    case KeyTab.PUBLIC:
      result = publicKeysList.value;
      break;
  }

  result = filterKeyList(result, searchInput.value);

  if (props.alreadyAdded && props.alreadyAdded.length > 0) {
    return result.filter(k => !props.alreadyAdded?.includes(k.publicKey));
  } else {
    return result;
  }
});

/* Handlers */
const handleInsert = () => {
  if (props.multiple && selectedPublicKeys.value.length === 0 && publicKey.value.trim() === '')
    return;

  if (!props.multiple && !isPublicKey(publicKey.value.trim())) {
    throw new Error('Invalid public key');
  }

  try {
    const manualKey = publicKey.value.trim()
      ? PublicKey.fromString(publicKey.value.trim())
      : undefined;

    if (!props.multiple) {
      if (!manualKey) {
        throw new Error('Invalid public key');
      }
      emit('selected:single', manualKey);
    } else {
      const publicKeys = selectedPublicKeys.value.map(pk => PublicKey.fromString(pk));
      manualKey && publicKeys.push(manualKey);

      emit('selected:multiple', publicKeys);
    }

    publicKey.value = '';
    selectedPublicKeys.value = [];
    emit('update:show', false);
  } catch {
    throw new Error('Invalid public key/s');
  }
};

const handleKeyTabChange = async (tab: KeyTab) => {
  currentTab.value = tab;
};

/* Functions */
function filterKeyList(keyList: { publicKey: string; nickname: string | null }[], query: string) {
  query = query.trim().toLowerCase();
  return keyList.filter(key => {
    const contact = contacts.getContactByPublicKey(key.publicKey);
    const email = contact?.user.email?.toLowerCase() || '';
    const nickname = key.nickname?.toLowerCase() || '';

    return (
      key.publicKey.toLowerCase().includes(query) ||
      nickname.includes(query) ||
      email.includes(query)
    );
  });
}

/* Hooks */
onBeforeMount(async () => {
  await user.refetchPublicKeys();
});

/* Watchers */
watch(
  listedKeyList,
  async newList => {
    if (newList.length === 0) {
      identifiers.value = [];
      return;
    }

    isLoadingIdentifiers.value = true;

    try {
      const tempIdentifiers = await Promise.all(
        newList.map(async key => {
          try {
            const identifier = await findIdentifier(key.publicKey);
            return identifier || 'Public Key';
          } catch (error) {
            console.error(`Failed to find owner/nickname for key: ${key.publicKey}`, error);
            return 'Public Key';
          }
        }),
      );

      identifiers.value = tempIdentifiers;
    } catch (error) {
      console.error('Error processing identifiers:', error);
    } finally {
      isLoadingIdentifiers.value = false;
    }
  },
  { immediate: true },
);
</script>
<template>
  <AppModal :show="show" @update:show="$emit('update:show', $event)" class="large-modal">
    <div class="p-4">
      <form @submit.prevent="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Add Public Key</h1>

        <p class="text-micro text-bold mt-5">Search by or paste public key</p>
        <div class="mt-3">
          <AppInput
            v-model:model-value="searchInput"
            data-testid="input-complex-public-key"
            filled
            type="text"
            placeholder="Public Key"
          />
        </div>

        <hr class="separator my-5" />

        <template v-if="isLoggedInOrganization(user.selectedOrganization)">
          <div class="btn-group-container" role="group">
            <div class="btn-group d-flex justify-content-between gap-3">
              <template v-for="kt in KeyTab" :key="kt">
                <AppButton
                  class="rounded-3 text-nowrap"
                  @click="handleKeyTabChange(kt)"
                  :class="{ active: currentTab === kt, 'text-body': currentTab !== kt }"
                  :color="currentTab === kt ? 'primary' : undefined"
                  type="button"
                  data-testid="tab-keys-my"
                  >{{ kt }}</AppButton
                >
              </template>
            </div>
          </div>
        </template>
        <div>
          <template v-if="listedKeyList.length > 0 && !isLoadingIdentifiers">
            <div class="overflow-auto mt-4" :style="{ height: '35vh' }">
              <template v-for="(kp, index) in listedKeyList" :key="kp.publicKey">
                <AppListItem
                  class="mt-3"
                  :selected="
                    multiple
                      ? selectedPublicKeys.includes(kp.publicKey)
                      : publicKey === kp.publicKey
                  "
                  :value="kp.publicKey"
                  @click="
                    multiple
                      ? (selectedPublicKeys = selectedPublicKeys.includes(kp.publicKey)
                          ? selectedPublicKeys.filter(id => id !== kp.publicKey)
                          : [...selectedPublicKeys, kp.publicKey])
                      : (publicKey = kp.publicKey)
                  "
                >
                  <div class="d-flex overflow-hidden">
                    <p class="text-nowrap">
                      <span class="bi bi-key m-2"></span>
                      <span class="ms-2 text-nowrap">{{ identifiers[index] }}</span>
                    </p>
                    <div class="border-start px-4 mx-4">
                      <span>{{ kp.publicKey }}</span>
                    </div>
                  </div>
                </AppListItem>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="flex-centered flex-column mt-4" :style="{ height: '35vh' }">
              <p class="text-muted">There are no selectable public keys</p>
            </div>
          </template>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="secondary" type="button" @click="$emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-insert-public-key"
            type="submit"
            :disabled="!isPublicKey(publicKey) && selectedPublicKeys.length === 0"
            >Insert</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
