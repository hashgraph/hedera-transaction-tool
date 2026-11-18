// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';

import ContactList from '@renderer/pages/ContactList/ContactList.vue';

const mocks = vi.hoisted(() => ({
  accountsGetAll: vi.fn().mockResolvedValue([]),
  routerPush: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    },
  },
  contactsStore: {
    contacts: [] as any[],
    fetching: false,
    fetch: vi.fn(),
  },
  notificationsStore: {
    notifications: {} as Record<string, any[]>,
  },
  setCanViewReports: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
  })),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/stores/storeNotifications', () => ({
  default: vi.fn(() => mocks.notificationsStore),
}));

vi.mock('@renderer/composables/useRedirectOnOnlyOrganization', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/useMarkNotifications', () => ({
  default: vi.fn(() => ({
    oldNotifications: { value: [] },
  })),
}));

vi.mock('@renderer/services/accountsService', () => ({
  getAll: mocks.accountsGetAll,
}));

vi.mock('@renderer/services/organization', () => ({
  deleteUser: vi.fn(),
  elevateUserToAdmin: vi.fn(),
  setCanViewReports: mocks.setCanViewReports,
}));

vi.mock('@renderer/services/contactsService', () => ({
  removeContact: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
    })),
  },
}));

describe('ContactList.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.accountsGetAll.mockResolvedValue([]);
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    };
    mocks.contactsStore.contacts = [];
    mocks.contactsStore.fetching = false;
    mocks.contactsStore.fetch.mockReset();
    mocks.notificationsStore.notifications = {};
    mocks.setCanViewReports.mockClear();
    mocks.toastSuccess.mockClear();
  });

  function mountContactList() {
    return mount(ContactList, {
      global: {
        mocks: {
          $router: {
            push: mocks.routerPush,
          },
        },
        stubs: {
          AppButton: {
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          AppLoader: {
            template: '<div />',
          },
          ContactDetails: {
            props: ['contact'],
            template:
              '<div data-testid="stub-contact-details">{{ contact.user.email }}' +
              '<button data-testid="btn-toggle-view-reports" @click="$emit(\'toggle-view-reports\')" /></div>',
          },
          DeleteContactModal: {
            template: '<div />',
          },
          ElevateContactModal: {
            template: '<div />',
          },
          Transition: false,
        },
      },
    });
  }

  test('shows the empty contacts message when the contacts store has no contacts', async () => {
    const wrapper = mountContactList();

    const emptyState = wrapper.find('[data-testid="p-no-contacts-found"]');

    expect(emptyState.exists()).toBe(true);
    expect(emptyState.text()).toBe('No contacts found');
    expect(wrapper.findAll('[data-testid^="p-contact-email-"]')).toHaveLength(0);
  });

  test('filters contacts without keys for non-admin users', () => {
    mocks.contactsStore.contacts = [
      {
        user: { id: 1, email: 'with-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
      {
        user: { id: 2, email: 'without-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [],
        nickname: '',
        nicknameId: null,
      },
    ];

    const wrapper = mountContactList();

    expect(wrapper.find('[data-testid="button-add-new-contact"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="p-contact-email-with-key@example.com"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="p-contact-email-without-key@example.com"]').exists()).toBe(
      false,
    );
  });

  test('shows admin-only add button and all contacts for admins', () => {
    mocks.userStore.selectedOrganization.admin = true;
    mocks.contactsStore.contacts = [
      {
        user: { id: 1, email: 'with-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
      {
        user: { id: 2, email: 'without-key@example.com', admin: false, status: 'ACTIVE' },
        userKeys: [],
        nickname: '',
        nicknameId: null,
      },
    ];

    const wrapper = mountContactList();

    expect(wrapper.find('[data-testid="button-add-new-contact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-contact-email-with-key@example.com"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="p-contact-email-without-key@example.com"]').exists()).toBe(
      true,
    );
  });

  test('shows registered, admin, and update-available indicators', () => {
    mocks.userStore.selectedOrganization.admin = true;
    mocks.contactsStore.contacts = [
      {
        user: {
          id: 1,
          email: 'new-admin@example.com',
          admin: true,
          status: 'NEW',
          updateAvailable: true,
        },
        userKeys: [{ id: 1, publicKey: 'key-1' }],
        nickname: '',
        nicknameId: null,
      },
    ];
    mocks.notificationsStore.notifications = {
      'https://org.example.com': [
        {
          notification: {
            type: 'USER_REGISTERED',
            entityId: 1,
          },
        },
      ],
    };

    const wrapper = mountContactList();

    expect(
      wrapper.find('[data-testid="span-contact-notification-indicator-new-admin@example.com"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('admin');
    expect(wrapper.text()).toContain('new');
    expect(wrapper.text()).toContain('update available');
  });

  test('routes admins to contact creation when Add New is clicked', async () => {
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountContactList();
    await wrapper.find('[data-testid="button-add-new-contact"]').trigger('click');
    await nextTick();

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'signUpUser' });
  });

  describe('search, sort and grouping', () => {
    const makeContact = (
      id: number,
      email: string,
      opts: { admin?: boolean; nickname?: string; createdAt?: string } = {},
    ) => ({
      user: {
        id,
        email,
        admin: opts.admin ?? false,
        status: 'NONE',
        createdAt: opts.createdAt ?? '2024-01-01T00:00:00.000Z',
      },
      userKeys: [{ id, publicKey: `key-${id}` }],
      nickname: opts.nickname ?? '',
      nicknameId: null,
    });

    const emails = (wrapper: ReturnType<typeof mountContactList>) =>
      wrapper
        .findAll('[data-testid^="p-contact-email-"]')
        .map(e => e.text());

    beforeEach(() => {
      mocks.contactsStore.contacts = [
        makeContact(1, 'carol@example.com', { createdAt: '2024-03-01T00:00:00.000Z' }),
        makeContact(2, 'zed-admin@example.com', { admin: true }),
        makeContact(3, 'alice@example.com', { createdAt: '2024-05-01T00:00:00.000Z' }),
        makeContact(4, 'bob@example.com', {
          nickname: 'Bob Smith',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeContact(5, 'amy-admin@example.com', { admin: true }),
      ];
    });

    test('lists all contacts, admins included, sorted by name A-Z by default', () => {
      const wrapper = mountContactList();

      expect(emails(wrapper)).toEqual([
        'alice@example.com',
        'amy-admin@example.com',
        'bob@example.com',
        'carol@example.com',
        'zed-admin@example.com',
      ]);
    });

    test.each([
      [
        'name-desc',
        [
          'zed-admin@example.com',
          'carol@example.com',
          'bob@example.com',
          'amy-admin@example.com',
          'alice@example.com',
        ],
      ],
      [
        'newest',
        [
          'alice@example.com',
          'carol@example.com',
          'amy-admin@example.com',
          'bob@example.com',
          'zed-admin@example.com',
        ],
      ],
      [
        'oldest',
        [
          'amy-admin@example.com',
          'bob@example.com',
          'zed-admin@example.com',
          'carol@example.com',
          'alice@example.com',
        ],
      ],
    ])('sorts every contact, admins included, by %s', async (option, expected) => {
      const wrapper = mountContactList();

      await wrapper.find(`[data-testid="select-item-${option}"]`).trigger('click');

      expect(emails(wrapper)).toEqual(expected);
    });

    test('filters by email, case-insensitively, without pressing enter', async () => {
      const wrapper = mountContactList();

      await wrapper.find('[data-testid="input-search-contacts"]').setValue('ALI');

      expect(emails(wrapper)).toEqual(['alice@example.com']);
    });

    test('filters by nickname, including spaces', async () => {
      const wrapper = mountContactList();

      await wrapper.find('[data-testid="input-search-contacts"]').setValue('bob sm');

      expect(emails(wrapper)).toEqual(['bob@example.com']);
    });

    test('keeps the sort order while filtered and restores the full list when cleared', async () => {
      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-name-desc"]').trigger('click');

      const input = wrapper.find('[data-testid="input-search-contacts"]');
      await input.setValue('example');
      expect(emails(wrapper)).toEqual([
        'zed-admin@example.com',
        'carol@example.com',
        'bob@example.com',
        'amy-admin@example.com',
        'alice@example.com',
      ]);

      await input.setValue('');
      expect(emails(wrapper)).toHaveLength(5);
    });

    test('shows the empty state when nothing matches', async () => {
      const wrapper = mountContactList();

      await wrapper.find('[data-testid="input-search-contacts"]').setValue('nobody');

      expect(wrapper.find('[data-testid="p-no-contacts-found"]').exists()).toBe(true);
    });

    test('selects the first result when the selected contact is filtered out', async () => {
      const wrapper = mountContactList();
      await flushPromises();
      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'alice@example.com',
      );

      await wrapper.find('[data-testid="input-search-contacts"]').setValue('carol');

      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'carol@example.com',
      );
    });

    test('clears the selection when nothing matches', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="input-search-contacts"]').setValue('nobody');

      expect(wrapper.find('.is-selected').exists()).toBe(false);
    });
  });

  describe('search and sort edge cases', () => {
    const contact = (
      id: number,
      email: string,
      opts: {
        admin?: boolean;
        keys?: boolean;
        nickname?: string;
        createdAt?: string;
      } = {},
    ) => ({
      user: {
        id,
        email,
        admin: opts.admin ?? false,
        status: 'NONE',
        createdAt: opts.createdAt ?? '2024-01-01T00:00:00.000Z',
      },
      userKeys: opts.keys === false ? [] : [{ id, publicKey: `key-${id}` }],
      nickname: opts.nickname ?? '',
      nicknameId: null,
    });

    const emails = (wrapper: ReturnType<typeof mountContactList>) =>
      wrapper.findAll('[data-testid^="p-contact-email-"]').map(e => e.text());

    const search = (wrapper: ReturnType<typeof mountContactList>, value: string) =>
      wrapper.find('[data-testid="input-search-contacts"]').setValue(value);

    test('renders the search input and the sort dropdown', () => {
      const wrapper = mountContactList();

      expect(wrapper.find('[data-testid="input-search-contacts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dropdown-sort-contacts"]').exists()).toBe(true);
    });

    test('offers every sort option and defaults to name A-Z', () => {
      const wrapper = mountContactList();

      for (const option of ['name-asc', 'name-desc', 'newest', 'oldest']) {
        expect(wrapper.find(`[data-testid="select-item-${option}"]`).exists()).toBe(true);
      }
      expect(wrapper.find('[data-testid="dropdown-sort-contacts"]').text()).toBe('Name A–Z');
    });

    test('name sort ignores letter case', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'bob@example.com'),
        contact(2, 'Alice@example.com'),
        contact(3, 'carol@example.com'),
      ];

      const wrapper = mountContactList();

      expect(emails(wrapper)).toEqual([
        'Alice@example.com',
        'bob@example.com',
        'carol@example.com',
      ]);
    });

    test('ties on creation date fall back to name A-Z', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'b@example.com', { createdAt: '2024-02-01T00:00:00.000Z' }),
        contact(2, 'a@example.com', { createdAt: '2024-02-01T00:00:00.000Z' }),
      ];

      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-newest"]').trigger('click');

      expect(emails(wrapper)).toEqual(['a@example.com', 'b@example.com']);
    });

    test('contacts with an unparseable creation date sort as the oldest', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'bad@example.com', { createdAt: 'not-a-date' }),
        contact(2, 'good@example.com', { createdAt: '2024-02-01T00:00:00.000Z' }),
      ];

      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-newest"]').trigger('click');

      expect(emails(wrapper)).toEqual(['good@example.com', 'bad@example.com']);
    });

    test('changing the sort does not change the selected contact', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'a@example.com', { createdAt: '2024-01-01T00:00:00.000Z' }),
        contact(2, 'b@example.com', { createdAt: '2024-02-01T00:00:00.000Z' }),
      ];

      const wrapper = mountContactList();
      await flushPromises();
      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'a@example.com',
      );

      await wrapper.find('[data-testid="select-item-newest"]').trigger('click');

      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'a@example.com',
      );
    });

    test('ignores surrounding whitespace in the search term', async () => {
      mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];

      const wrapper = mountContactList();
      await search(wrapper, '  alice  ');

      expect(emails(wrapper)).toEqual(['alice@example.com']);
    });

    test('a whitespace-only search shows the full list', async () => {
      mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];

      const wrapper = mountContactList();
      await search(wrapper, '   ');

      expect(emails(wrapper)).toHaveLength(2);
    });

    test('matches a nickname even when the email does not contain the term', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'one@example.com', { nickname: 'Dana' }),
        contact(2, 'two@example.com', { nickname: 'Eli' }),
      ];

      const wrapper = mountContactList();
      await search(wrapper, 'dana');

      expect(emails(wrapper)).toEqual(['one@example.com']);
    });

    test('matches on a partial email in the middle of the address', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'jane.doe@corp.com'),
        contact(2, 'sam@corp.com'),
      ];

      const wrapper = mountContactList();
      await search(wrapper, 'e.d');

      expect(emails(wrapper)).toEqual(['jane.doe@corp.com']);
    });

    test('search does not reveal contacts without keys to non-admins', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'visible@example.com'),
        contact(2, 'hidden@example.com', { keys: false }),
      ];

      const wrapper = mountContactList();
      await search(wrapper, 'hidden');

      expect(emails(wrapper)).toEqual([]);
      expect(wrapper.find('[data-testid="p-no-contacts-found"]').exists()).toBe(true);
    });

    test('search finds contacts without keys for admins', async () => {
      mocks.userStore.selectedOrganization.admin = true;
      mocks.contactsStore.contacts = [
        contact(1, 'visible@example.com'),
        contact(2, 'pending@example.com', { keys: false }),
      ];

      const wrapper = mountContactList();
      await search(wrapper, 'pending');

      expect(emails(wrapper)).toEqual(['pending@example.com']);
    });

    test('keeps the current selection when it still matches the search', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'alice@example.com'),
        contact(2, 'alicia@example.com'),
      ];

      const wrapper = mountContactList();
      await flushPromises();
      await wrapper.find('[data-testid="p-contact-email-alicia@example.com"]').trigger('click');

      await search(wrapper, 'ali');

      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'alicia@example.com',
      );
    });

    test('keeps the selection after the search is cleared', async () => {
      mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];

      const wrapper = mountContactList();
      await flushPromises();
      await search(wrapper, 'bob');
      await search(wrapper, '');

      expect(emails(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'bob@example.com',
      );
    });

    test('reselects a contact after a no-match search is replaced by a matching one', async () => {
      mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];

      const wrapper = mountContactList();
      await flushPromises();
      await search(wrapper, 'nobody');
      await search(wrapper, 'bob');

      expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
        'bob@example.com',
      );
    });

    test('admins are sorted with everyone else and still show their badge', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'zoe@example.com'),
        contact(2, 'aaron@example.com', { admin: true }),
        contact(3, 'mia@example.com'),
      ];

      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-name-desc"]').trigger('click');

      expect(emails(wrapper)).toEqual(['zoe@example.com', 'mia@example.com', 'aaron@example.com']);
      expect(wrapper.text()).toContain('admin');
    });

    test('does not mutate the contacts store order when sorting', async () => {
      mocks.contactsStore.contacts = [contact(1, 'b@example.com'), contact(2, 'a@example.com')];

      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-name-desc"]').trigger('click');

      expect(mocks.contactsStore.contacts.map(c => c.user.email)).toEqual([
        'b@example.com',
        'a@example.com',
      ]);
    });
  });

  describe('sorting by display name (nickname, falling back to email)', () => {
    const contact = (id: number, email: string, nickname = '') => ({
      user: { id, email, admin: false, status: 'NONE', createdAt: '2024-01-01T00:00:00.000Z' },
      userKeys: [{ id, publicKey: `key-${id}` }],
      nickname,
      nicknameId: nickname ? `nick-${id}` : null,
    });

    const emails = (wrapper: ReturnType<typeof mountContactList>) =>
      wrapper.findAll('[data-testid^="p-contact-email-"]').map(e => e.text());

    test('sorts by nickname when set and by email when not, interleaved', () => {
      mocks.contactsStore.contacts = [
        contact(1, 'zara@example.com'),
        contact(2, 'aaa@example.com', 'Maria'),
        contact(3, 'mike@example.com'),
        contact(4, 'bbb@example.com', 'Bob'),
      ];

      const wrapper = mountContactList();

      // Bob, Maria, mike@..., zara@...
      expect(emails(wrapper)).toEqual([
        'bbb@example.com',
        'aaa@example.com',
        'mike@example.com',
        'zara@example.com',
      ]);
    });

    test('name Z-A reverses the display-name order', async () => {
      mocks.contactsStore.contacts = [
        contact(1, 'zara@example.com'),
        contact(2, 'aaa@example.com', 'Maria'),
        contact(3, 'bbb@example.com', 'Bob'),
      ];

      const wrapper = mountContactList();
      await wrapper.find('[data-testid="select-item-name-desc"]').trigger('click');

      expect(emails(wrapper)).toEqual([
        'zara@example.com',
        'aaa@example.com',
        'bbb@example.com',
      ]);
    });

    test('contacts with the same display name are ordered by email', () => {
      mocks.contactsStore.contacts = [
        contact(1, 'b@example.com', 'Sam'),
        contact(2, 'a@example.com', 'sam'),
      ];

      const wrapper = mountContactList();

      expect(emails(wrapper)).toEqual(['a@example.com', 'b@example.com']);
    });

    describe('when a nickname changes', () => {
      // The real store is reactive (Pinia); mirror that so list updates can be observed
      const useReactiveStore = (contacts: ReturnType<typeof contact>[]) => {
        mocks.contactsStore = reactive({
          contacts,
          fetching: false,
          fetch: vi.fn(),
        });
      };

      const mountWith = (contacts: ReturnType<typeof contact>[]) => {
        useReactiveStore(contacts);
        return mountContactList();
      };

      const initial = () => [
        contact(1, 'alice@example.com'),
        contact(2, 'bob@example.com'),
        contact(3, 'zed@example.com'),
      ];

      test('adding a nickname re-sorts the list (in-place update, as ContactDetails does)', async () => {
        const wrapper = mountWith(initial());
        expect(emails(wrapper)).toEqual([
          'alice@example.com',
          'bob@example.com',
          'zed@example.com',
        ]);

        mocks.contactsStore.contacts[0].nickname = 'Zzz';
        await nextTick();

        expect(emails(wrapper)).toEqual([
          'bob@example.com',
          'zed@example.com',
          'alice@example.com',
        ]);
      });

      test('changing a nickname re-sorts the list', async () => {
        const wrapper = mountWith([
          contact(1, 'alice@example.com', 'Aaa'),
          contact(2, 'bob@example.com', 'Bbb'),
        ]);

        mocks.contactsStore.contacts[0].nickname = 'Ccc';
        await nextTick();

        expect(emails(wrapper)).toEqual(['bob@example.com', 'alice@example.com']);
      });

      test('removing a nickname re-sorts the contact by its email again', async () => {
        const wrapper = mountWith([
          contact(1, 'alice@example.com', 'Zzz'),
          contact(2, 'bob@example.com'),
        ]);
        expect(emails(wrapper)).toEqual(['bob@example.com', 'alice@example.com']);

        mocks.contactsStore.contacts[0].nickname = '';
        await nextTick();

        expect(emails(wrapper)).toEqual(['alice@example.com', 'bob@example.com']);
      });

      test('re-sorts when the store replaces its contacts after a refetch', async () => {
        const wrapper = mountWith(initial());

        mocks.contactsStore.contacts = [
          contact(1, 'alice@example.com', 'Zzz'),
          contact(2, 'bob@example.com'),
          contact(3, 'zed@example.com'),
        ];
        await nextTick();

        expect(emails(wrapper)).toEqual([
          'bob@example.com',
          'zed@example.com',
          'alice@example.com',
        ]);
      });

      test('keeps the edited contact selected while it moves', async () => {
        const wrapper = mountWith(initial());
        await flushPromises();
        expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
          'alice@example.com',
        );

        mocks.contactsStore.contacts[0].nickname = 'Zzz';
        await nextTick();

        expect(wrapper.find('[data-testid="stub-contact-details"]').text()).toContain(
          'alice@example.com',
        );
      });

      test('a new nickname is searchable straight away', async () => {
        const wrapper = mountWith(initial());

        mocks.contactsStore.contacts[1].nickname = 'Quincy';
        await nextTick();
        await wrapper.find('[data-testid="input-search-contacts"]').setValue('quin');

        expect(emails(wrapper)).toEqual(['bob@example.com']);
      });

      test('a removed nickname is no longer searchable', async () => {
        const wrapper = mountWith([contact(1, 'alice@example.com', 'Quincy')]);

        mocks.contactsStore.contacts[0].nickname = '';
        await nextTick();
        await wrapper.find('[data-testid="input-search-contacts"]').setValue('quin');

        expect(emails(wrapper)).toEqual([]);
      });
    });
  });

  describe('toggling report API access off', () => {
    beforeEach(() => {
      mocks.userStore.selectedOrganization.admin = true;
      mocks.contactsStore.contacts = [
        {
          user: {
            id: 1,
            email: 'with-key@example.com',
            admin: false,
            status: 'ACTIVE',
            canViewReports: true,
            apiKeyStatus: { hasKey: true },
          },
          userKeys: [{ id: 1, publicKey: 'key-1' }],
          nickname: '',
          nicknameId: null,
        },
      ];
    });

    test('shows the revoke confirmation prompt when the contact has an API key', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: block');
      expect(mocks.setCanViewReports).not.toHaveBeenCalled();
    });

    test('does not revoke access if the confirmation prompt is declined', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      const cancelButton = wrapper.findAll('button').find(btn => btn.text() === 'Cancel');
      await cancelButton?.trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).not.toHaveBeenCalled();
    });

    test('revokes access once the confirmation prompt is accepted', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      await wrapper.find('[data-testid="revoke-view-reports-confirm"]').trigger('click');
      await nextTick();

      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });

    test('shows a success toast and refetches contacts once access is revoked', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();
      await wrapper.find('[data-testid="revoke-view-reports-confirm"]').trigger('click');
      await flushPromises();

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Report access revoked successfully',
        'view-reports-access-1',
      );
      expect(mocks.contactsStore.fetch).toHaveBeenCalled();
    });

    test('skips the confirmation prompt when the contact has no API key', async () => {
      mocks.contactsStore.contacts[0].user.apiKeyStatus = { hasKey: false };

      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });

    test('skips the confirmation prompt when the existing key is already revoked', async () => {
      mocks.contactsStore.contacts[0].user.apiKeyStatus = {
        hasKey: true,
        revokedAt: '2026-01-01T00:00:00.000Z',
      };

      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await nextTick();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        false,
      );
    });
  });

  describe('granting report API access', () => {
    beforeEach(() => {
      mocks.userStore.selectedOrganization.admin = true;
      mocks.contactsStore.contacts = [
        {
          user: {
            id: 1,
            email: 'no-access@example.com',
            admin: false,
            status: 'ACTIVE',
            canViewReports: false,
            apiKeyStatus: { hasKey: false },
          },
          userKeys: [{ id: 1, publicKey: 'key-1' }],
          nickname: '',
          nicknameId: null,
        },
      ];
    });

    test('grants access immediately without a confirmation prompt', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await flushPromises();

      const modal = wrapper.find('[data-testid="modal-confirm-transaction"]');
      expect(modal.attributes('style')).toContain('display: none');
      expect(mocks.setCanViewReports).toHaveBeenCalledWith(
        'https://org.example.com',
        1,
        true,
      );
    });

    test('shows a success toast and refetches contacts once access is granted', async () => {
      const wrapper = mountContactList();
      await flushPromises();

      await wrapper.find('[data-testid="btn-toggle-view-reports"]').trigger('click');
      await flushPromises();

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Report access granted successfully',
        'view-reports-access-1',
      );
      expect(mocks.contactsStore.fetch).toHaveBeenCalled();
    });
  });
});
