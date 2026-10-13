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
  formatDateTime: vi.fn(() => 'Jan 1, 2026 12:00 PM'),
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
      canViewReports: false,
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
    mocks.userStore.selectedOrganization.userId = 10;
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

  test('shows a toggleable switch for report API access on non-admin contacts', () => {
    const wrapper = mountContactDetails();

    expect(wrapper.find('[data-testid="switch-report-api-access"]').exists()).toBe(true);
  });

  function mountWithContact(overrideContact: Contact) {
    mocks.contactsStore.contacts = [overrideContact];
    return mount(ContactDetails, {
      props: {
        contact: overrideContact,
        linkedAccounts: [],
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot /></button>' },
          AppInput: { template: '<input />' },
          ContactDetailsAssociatedAccounts: { template: '<div />' },
          ContactDetailsLinkedAccounts: { template: '<div />' },
          RenamePublicKeyModal: { template: '<div />' },
        },
      },
    });
  }

  test('shows key status but no toggle when the contact is an admin', () => {
    const adminContact: Contact = {
      ...contact,
      user: {
        ...contact.user,
        admin: true,
        canViewReports: true,
        apiKeyStatus: {
          hasKey: true,
          keyId: 'key-id',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null,
          revokedReason: null,
          idleExpiryDays: 180,
        },
      },
    };

    const wrapper = mountWithContact(adminContact);

    expect(wrapper.find('[data-testid="switch-report-api-access"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Report API access');
    expect(wrapper.find('[data-testid="p-contact-api-key-id"]').exists()).toBe(true);
  });

  test('does not show key details for a revoked key, even though the row still exists', () => {
    const revokedContact: Contact = {
      ...contact,
      user: {
        ...contact.user,
        canViewReports: true,
        apiKeyStatus: {
          hasKey: true,
          keyId: 'key-id',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: '2026-01-02T00:00:00.000Z',
          revokedAt: '2026-01-03T00:00:00.000Z',
          revokedReason: 'inactivity',
          idleExpiryDays: 180,
        },
      },
    };

    const wrapper = mountWithContact(revokedContact);

    expect(wrapper.find('[data-testid="p-contact-api-key-id"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="p-contact-api-key-revoked"]').exists()).toBe(true);
  });

  test('shows "no key created" when the contact has report access but has never generated a key', () => {
    const neverGeneratedContact: Contact = {
      ...contact,
      user: {
        ...contact.user,
        canViewReports: true,
        apiKeyStatus: {
          hasKey: false,
          keyId: null,
          createdAt: null,
          lastUsedAt: null,
          revokedAt: null,
          revokedReason: null,
          idleExpiryDays: 180,
        },
      },
    };

    const wrapper = mountWithContact(neverGeneratedContact);

    expect(wrapper.find('[data-testid="p-contact-no-api-key"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-contact-api-key-id"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="p-contact-api-key-revoked"]').exists()).toBe(false);
  });

  test('shows "key status unavailable" when the contact has report access but no status was returned', () => {
    const unavailableStatusContact: Contact = {
      ...contact,
      user: {
        ...contact.user,
        canViewReports: true,
        apiKeyStatus: undefined,
      },
    };

    const wrapper = mountWithContact(unavailableStatusContact);

    expect(wrapper.find('[data-testid="p-contact-api-key-unavailable"]').exists()).toBe(true);
  });

  test('emits toggle-view-reports when the switch is toggled', async () => {
    const wrapper = mountContactDetails();

    await wrapper.find('input[data-testid="switch-report-api-access"]').setValue(true);

    expect(wrapper.emitted('toggle-view-reports')).toHaveLength(1);
  });

  test('hides the report API access section entirely for non-admin viewers', () => {
    mocks.userStore.selectedOrganization.admin = false;

    const wrapper = mountContactDetails();

    expect(wrapper.text()).not.toContain('Report API access');
    expect(wrapper.find('[data-testid="switch-report-api-access"]').exists()).toBe(false);
  });

  test('hides the report API access section for the viewer\'s own contact row', () => {
    mocks.userStore.selectedOrganization.userId = contact.user.id;

    const wrapper = mountContactDetails();

    expect(wrapper.text()).not.toContain('Report API access');
  });
});
