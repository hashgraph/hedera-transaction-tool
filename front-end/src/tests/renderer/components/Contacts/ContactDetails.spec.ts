// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { Contact } from '@shared/interfaces';

import ContactDetails from '@renderer/components/Contacts/ContactDetails.vue';
import { getAllPublicKeyMappings } from '@renderer/utils';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: true,
      id: 'org-id',
      serverUrl: 'https://org.example.com',
      userId: 10,
    },
  },
  contactsStore: {
    contacts: [] as any[],
    fetch: vi.fn(),
    fetchUserKeys: vi.fn().mockResolvedValue(undefined),
  },
  accountLookup: vi.fn().mockResolvedValue({}),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  // Strip the standard ED25519 DER prefix so toStringRaw() returns the raw hex key,
  // matching real SDK behaviour and making DER vs raw mismatches visible in tests.
  const ED25519_DER_PREFIX = '302a300506032b6570032100';
  return {
    ...actual,
    PublicKey: {
      fromString: vi.fn((key: string) => ({
        toStringRaw: () =>
          key.startsWith(ED25519_DER_PREFIX) ? key.slice(ED25519_DER_PREFIX.length) : key,
        _key: {
          _type: 'ED25519',
        },
      })),
    },
  };
});

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    mirrorNodeBaseURL: 'https://mirror.example.com',
  })),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/services/contactsService', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock('@renderer/services/organization', () => ({
  signUp: vi.fn(),
}));

vi.mock('@renderer/composables/user/useDateTimeSetting.ts', () => ({
  default: vi.fn(() => ({
    isUtcSelected: { value: false },
  })),
}));

vi.mock('@renderer/utils/clientVersion.ts', () => ({
  getLatestClient: vi.fn(() => null),
}));

vi.mock('@renderer/utils/dateTimeFormat.ts', () => ({
  formatDatePart: vi.fn(() => 'Jan 1, 2026'),
}));

vi.mock('@renderer/caches/mirrorNode/AccountByPublicKeyCache.ts', () => {
  class AccountByPublicKeyCache {
    static inject = vi.fn(() => ({
      batchLookup: mocks.accountLookup,
    }));

    batchLookup = mocks.accountLookup;
  }

  return {
    AccountByPublicKeyCache,
  };
});

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: vi.fn(),
      success: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  extractIdentifier: vi.fn((value: string) => ({ identifier: value })),
  getAllPublicKeyMappings: vi.fn().mockResolvedValue([]),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  getPublicKeyMapping: vi.fn(() => null),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

describe('ContactDetails.vue', () => {
  const contact: Contact = {
    user: {
      id: 20,
      email: 'member@example.com',
      admin: false,
      status: 'NONE',
      keys: [],
      clients: [],
    },
    userKeys: [
      {
        id: 1,
        userId: 20,
        publicKey: '302a300506032b6570032100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
    nickname: '',
    nicknameId: null,
  };

  beforeEach(() => {
    mocks.userStore.selectedOrganization.admin = true;
    mocks.contactsStore.contacts = [contact];
    mocks.contactsStore.fetch.mockReset();
    mocks.contactsStore.fetchUserKeys.mockResolvedValue(undefined);
    mocks.accountLookup.mockResolvedValue({});
  });

  function mountContactDetails() {
    return mount(ContactDetails, {
      props: {
        contact,
        linkedAccounts: [],
      },
      global: {
        stubs: {
          AppButton: {
            template: '<button><slot /></button>',
          },
          AppInput: {
            template: '<input />',
          },
          ContactDetailsAssociatedAccounts: {
            template: '<div />',
          },
          ContactDetailsLinkedAccounts: {
            template: '<div />',
          },
          RenamePublicKeyModal: {
            template: '<div />',
          },
        },
      },
    });
  }

  test('renders contact email and public keys', async () => {
    const wrapper = mountContactDetails();
    await vi.dynamicImportSettled();

    expect(wrapper.find('[data-testid="p-contact-email"]').text()).toBe('member@example.com');
    expect(wrapper.find('[data-testid="p-contact-public-key-0"]').text()).toContain(
      contact.userKeys[0].publicKey,
    );
  });

  test('renders stored nickname when the mapping is keyed by a DER-formatted key', async () => {
    // The mapping is stored exactly as the user imported it — DER format.
    // handleFetchMapping must canonicalize both the stored key and the contact key
    // to raw before comparing; otherwise DER-stored nicknames are silently lost.
    vi.mocked(getAllPublicKeyMappings).mockResolvedValueOnce([
      { public_key: contact.userKeys[0].publicKey, nickname: 'Alice Key' } as any,
    ]);

    const wrapper = mountContactDetails();
    await vi.dynamicImportSettled();
    await flushPromises();

    expect(wrapper.html()).toContain('Alice Key');
  });

  test('shows admin contact actions only for organization admins', () => {
    const adminWrapper = mountContactDetails();
    expect(adminWrapper.find('[data-testid="button-remove-account-from-contact-list"]').exists()).toBe(
      true,
    );
    expect(adminWrapper.find('[data-testid="button-elevate-to-admin-from-contact-list"]').exists()).toBe(
      true,
    );

    mocks.userStore.selectedOrganization.admin = false;
    const regularWrapper = mountContactDetails();
    expect(
      regularWrapper.find('[data-testid="button-remove-account-from-contact-list"]').exists(),
    ).toBe(false);
    expect(
      regularWrapper.find('[data-testid="button-elevate-to-admin-from-contact-list"]').exists(),
    ).toBe(false);
  });
});
