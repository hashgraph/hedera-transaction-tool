// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import CreateReviewerGroup from '@renderer/pages/ReviewerGroups/CreateReviewerGroup/CreateReviewerGroup.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport';

/* ── ActionController stub — captures actionCallback so tests can invoke it directly ── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
}));

vi.mock('@renderer/components/ActionController/ActionController.vue', () => ({
  default: {
    props: ['actionCallback', 'activate', 'progressText', 'progressTitle', 'personalPasswordRequired', 'dataTestid'],
    setup(props: any) {
      capture.callback = props.actionCallback;
    },
    template: '<div />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  leaveGuard: null as ((to: { fullPath: string }) => boolean) | null,
  route: { params: {} },
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: true,
      serverUrl: 'https://org.example.com',
      userKeys: [{ id: 5, publicKey: 'org-public-key' }],
    },
    keyPairs: [{ public_key: 'org-public-key' }],
  },
  contactsStore: {
    getContact: vi.fn(
      (
        userId: number,
      ): { user: { id: number; email: string }; userKeys: { id: number; publicKey: string }[] } | undefined => ({
        user: { id: userId, email: `user${userId}@example.com` },
        userKeys: [{ id: userId * 10, publicKey: `public-key-${userId}` }],
      }),
    ),
  },
  reviewerGroupsStore: {
    fetch: vi.fn(),
  },
  createReviewerGroup: vi.fn(),
  getReviewerGroup: vi.fn(),
  updateReviewerGroup: vi.fn(),
  resolveReviewerSigningKey: vi.fn(),
  signReviewerPayload: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mocks.routerPush,
    back: mocks.routerBack,
  })),
  useRoute: vi.fn(() => mocks.route),
  onBeforeRouteLeave: vi.fn((guard: (to: { fullPath: string }) => boolean) => {
    mocks.leaveGuard = guard;
  }),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/stores/storeReviewerGroups', () => ({
  default: vi.fn(() => mocks.reviewerGroupsStore),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/services/organization', () => ({
  createReviewerGroup: mocks.createReviewerGroup,
  getReviewerGroup: mocks.getReviewerGroup,
  updateReviewerGroup: mocks.updateReviewerGroup,
}));

vi.mock('@renderer/components/ReviewerGroups/signReviewerPayload', () => ({
  resolveReviewerSigningKey: mocks.resolveReviewerSigningKey,
  signReviewerPayload: mocks.signReviewerPayload,
}));

vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    assertUserLoggedIn: vi.fn(),
    assertIsLoggedInOrganization: vi.fn(),
    isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  };
});

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
      error: mocks.toastError,
    })),
  },
}));

const pickerStub = {
  props: ['show', 'alreadyAdded'],
  emits: ['update:show', 'confirm'],
  template:
    '<div v-if="show" data-testid="stub-picker-modal">' +
    '{{ (alreadyAdded ?? []).join(",") }}' +
    '<button data-testid="picker-confirm" type="button" @click="$emit(\'confirm\', [{ userId: 2, userKeyId: 20 }, { userId: 3, userKeyId: 30 }]); $emit(\'update:show\', false)"></button>' +
    '<button data-testid="picker-cancel" type="button" @click="$emit(\'update:show\', false)"></button>' +
    '</div>',
};

describe('CreateReviewerGroup.vue', () => {
  beforeEach(() => {
    capture.callback = null;
    mocks.leaveGuard = null;
    mocks.route.params = {};
    mocks.routerPush.mockClear();
    mocks.routerBack.mockClear();
    mocks.contactsStore.getContact.mockClear();
    mocks.reviewerGroupsStore.fetch.mockReset();
    mocks.createReviewerGroup.mockReset();
    mocks.getReviewerGroup.mockReset();
    mocks.updateReviewerGroup.mockReset();
    mocks.resolveReviewerSigningKey.mockReset();
    mocks.resolveReviewerSigningKey.mockReturnValue({ orgKeyId: 5, orgKeyPublicKey: 'org-public-key' });
    mocks.signReviewerPayload.mockReset();
    mocks.signReviewerPayload.mockResolvedValue({ userKeyId: 5, userSignature: 'deadbeef' });
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
  });

  function mountPage() {
    return mount(CreateReviewerGroup, {
      global: {
        stubs: {
          AppButton: {
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          // AppTextArea is stubbed to avoid its auto-expand behavior in tests;
          // AppInput (used for Name) and AppAutoComplete (used for Threshold) need no
          // stub — both are tested directly elsewhere via real mounts (see
          // AppAutoComplete.spec.ts), so the same approach is used here.
          AppTextArea: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template:
              '<textarea v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          SelectGroupMembersModal: pickerStub,
        },
      },
    });
  }

  // Helper used by tests that only need a populated member list, not the picker flow
  // itself (covered separately below) — drives the real picker stub to get there.
  async function addTwoMembersViaPicker(wrapper: ReturnType<typeof mountPage>) {
    await wrapper.find('[data-testid="button-add-group-member"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="picker-confirm"]').trigger('click');
    await nextTick();
  }

  test('disables Create until a name and at least one member are set', async () => {
    const wrapper = mountPage();
    const submit = () => wrapper.find('[data-testid="button-submit-create-reviewer-group"]');

    expect(submit().attributes('disabled')).not.toBeUndefined();

    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
    expect(submit().attributes('disabled')).not.toBeUndefined();

    await addTwoMembersViaPicker(wrapper);
    expect(submit().attributes('disabled')).toBeUndefined();
  });

  test('keeps Create disabled when the name is only whitespace', async () => {
    const wrapper = mountPage();
    const submit = () => wrapper.find('[data-testid="button-submit-create-reviewer-group"]');

    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('   ');
    await addTwoMembersViaPicker(wrapper);

    expect(submit().attributes('disabled')).not.toBeUndefined();
  });

  test('clamps the threshold down when the member list shrinks below it', async () => {
    const wrapper = mountPage();
    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
    await addTwoMembersViaPicker(wrapper);

    await wrapper.findAll('.autocomplete-item-custom')[1].trigger('click');

    await wrapper.find('[data-testid="button-remove-group-member-3"]').trigger('click');
    await nextTick();

    expect(
      (wrapper.find('[data-testid="input-reviewer-group-threshold"]').element as HTMLInputElement).value,
    ).toBe('1');
  });

  test('the threshold select only offers values up to the member count', async () => {
    const wrapper = mountPage();
    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
    await addTwoMembersViaPicker(wrapper);

    const items = wrapper.findAll('.autocomplete-item-custom').map(item => item.text());

    expect(items).toEqual(['1', '2']);
  });

  test('selecting a threshold updates the value', async () => {
    const wrapper = mountPage();
    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
    await addTwoMembersViaPicker(wrapper);

    await wrapper.findAll('.autocomplete-item-custom')[0].trigger('click');

    expect(
      (wrapper.find('[data-testid="input-reviewer-group-threshold"]').element as HTMLInputElement).value,
    ).toBe('1');
  });

  test('returns the ActionReport early when no signing key is available, without signing or posting', async () => {
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    mountPage();
    expect(capture.callback).not.toBeNull();

    const result = await capture.callback!('password');

    expect(result).toBe(report);
    expect(mocks.signReviewerPayload).not.toHaveBeenCalled();
    expect(mocks.createReviewerGroup).not.toHaveBeenCalled();
  });

  test('signs the canonical snapshot payload, posts the raw member list, refetches, and navigates back', async () => {
    mocks.createReviewerGroup.mockResolvedValue({});

    const wrapper = mountPage();
    await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
    await wrapper.find('[data-testid="input-reviewer-group-description"]').setValue('Treasury movements');
    await addTwoMembersViaPicker(wrapper);

    expect(capture.callback).not.toBeNull();
    const result = await capture.callback!('my-password');

    expect(mocks.resolveReviewerSigningKey).toHaveBeenCalledWith(
      mocks.userStore.keyPairs,
      mocks.userStore.selectedOrganization.userKeys,
    );

    expect(mocks.signReviewerPayload).toHaveBeenCalledWith(
      'local-user-id',
      'my-password',
      5,
      'org-public-key',
      {
        name: 'Treasury',
        description: 'Treasury movements',
        threshold: 2,
        members: [
          { userId: 2, userKeyId: 20, publicKey: 'public-key-2' },
          { userId: 3, userKeyId: 30, publicKey: 'public-key-3' },
        ],
      },
    );

    expect(mocks.createReviewerGroup).toHaveBeenCalledWith('https://org.example.com', {
      name: 'Treasury',
      description: 'Treasury movements',
      threshold: 2,
      members: [
        { userId: 2, userKeyId: 20 },
        { userId: 3, userKeyId: 30 },
      ],
      userKeyId: 5,
      userSignature: 'deadbeef',
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Reviewer group created successfully');
    expect(mocks.reviewerGroupsStore.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  test('Cancel navigates back without submitting', async () => {
    const wrapper = mountPage();

    const cancelButton = wrapper.findAll('button').find(b => b.text() === 'Cancel');
    await cancelButton?.trigger('click');

    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(mocks.createReviewerGroup).not.toHaveBeenCalled();
  });

  describe('member picker modal', () => {
    test('clicking "Add Members" opens the picker modal', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');

      expect(wrapper.find('[data-testid="stub-picker-modal"]').exists()).toBe(false);

      await wrapper.find('[data-testid="button-add-group-member"]').trigger('click');
      await nextTick();

      expect(wrapper.find('[data-testid="stub-picker-modal"]').exists()).toBe(true);
    });

    test('confirming the picker merges new members into the list, sorted alphabetically', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');

      await wrapper.find('[data-testid="button-add-group-member"]').trigger('click');
      await nextTick();

      await wrapper.find('[data-testid="picker-confirm"]').trigger('click');
      await nextTick();

      // Picker stub confirms userId 2 and 3 (user2@example.com, user3@example.com) —
      // already sorted, but this also proves the merge actually landed in `members`.
      expect(wrapper.text()).toContain('of 2');
    });

    test('canceling the picker leaves members unchanged', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');

      await wrapper.find('[data-testid="button-add-group-member"]').trigger('click');
      await nextTick();

      await wrapper.find('[data-testid="picker-cancel"]').trigger('click');
      await nextTick();

      expect(wrapper.find('[data-testid="stub-picker-modal"]').exists()).toBe(false);
      // No members were added, so the threshold field (visible, but only editable once
      // members.length > 0) should still be inert — pe-none + tabindex, not a real
      // disabled attribute, so it doesn't look dimmed.
      const thresholdInput = wrapper.find('[data-testid="input-reviewer-group-threshold"]');
      expect(thresholdInput.classes()).toContain('pe-none');
      expect(thresholdInput.attributes('tabindex')).toBe('-1');
    });

    test('falls back to "User: {id}" when the member is no longer in contacts', async () => {
      mocks.contactsStore.getContact.mockImplementation((userId: number) =>
        userId === 2 ? undefined : { user: { id: userId, email: `user${userId}@example.com` }, userKeys: [] },
      );

      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
      await addTwoMembersViaPicker(wrapper);

      expect(wrapper.find('[data-testid="li-group-member-2"]').text()).toContain('User: 2');
      expect(wrapper.find('[data-testid="li-group-member-3"]').text()).toContain('user3@example.com');
    });

    test('already-added user ids are passed through to the picker', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
      await addTwoMembersViaPicker(wrapper);

      await wrapper.find('[data-testid="button-add-group-member"]').trigger('click');
      await nextTick();

      expect(wrapper.find('[data-testid="stub-picker-modal"]').text()).toContain('2,3');
    });
  });

  describe('leave confirmation', () => {
    test('allows navigation when the form is untouched', async () => {
      mountPage();
      expect(mocks.leaveGuard).not.toBeNull();

      const result = mocks.leaveGuard!({ fullPath: '/reviewer-groups' });

      expect(result).toBe(true);
    });

    test('blocks navigation and shows the prompt once name, description, or members are set', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');

      const result = mocks.leaveGuard!({ fullPath: '/reviewer-groups' });
      await nextTick();

      expect(result).toBe(false);
      expect(wrapper.find('[data-testid="modal-confirm-transaction"]').attributes('style')).toContain(
        'display: block',
      );
    });

    test('"Continue Editing" dismisses the prompt without navigating', async () => {
      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-description"]').setValue('Some notes');
      mocks.leaveGuard!({ fullPath: '/reviewer-groups' });
      await nextTick();

      await wrapper.findAll('form').at(-1)!.trigger('submit');
      await nextTick();

      expect(wrapper.find('[data-testid="modal-confirm-transaction"]').attributes('style')).toContain(
        'display: none',
      );
      expect(mocks.routerPush).not.toHaveBeenCalled();
    });

    test('"Discard Changes" navigates to the pending path', async () => {
      const wrapper = mountPage();
      await addTwoMembersViaPicker(wrapper);
      mocks.leaveGuard!({ fullPath: '/reviewer-groups' });
      await nextTick();

      await wrapper.find('[data-testid="button-confirm-leave-create-reviewer-group"]').trigger('click');

      expect(mocks.routerPush).toHaveBeenCalledWith('/reviewer-groups');
    });

    test('does not block navigation after a successful create', async () => {
      mocks.createReviewerGroup.mockResolvedValue({});

      const wrapper = mountPage();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury');
      await addTwoMembersViaPicker(wrapper);

      await capture.callback!('my-password');

      const result = mocks.leaveGuard!({ fullPath: '/reviewer-groups' });

      expect(result).toBe(true);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      // Some tests above override getContact's implementation (e.g. to simulate a
      // removed contact); restore the default so publicKey lookups here are not
      // affected by sibling-test ordering.
      mocks.contactsStore.getContact.mockImplementation((userId: number) => ({
        user: { id: userId, email: `user${userId}@example.com` },
        userKeys: [{ id: userId * 10, publicKey: `public-key-${userId}` }],
      }));
    });

    const groupDetail = {
      id: 7,
      name: 'Treasury',
      description: 'Treasury movements',
      threshold: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      members: [
        { id: 1, groupId: 7, userId: 2, userKeyId: 20, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 2, groupId: 7, userId: 3, userKeyId: 30, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      rules: [],
    };

    test('loads the existing group and prefills name, description, members, and threshold', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);

      const wrapper = mountPage();
      await flushPromises();

      expect(mocks.getReviewerGroup).toHaveBeenCalledWith('https://org.example.com', 7);
      expect(
        (wrapper.find('[data-testid="input-reviewer-group-name"]').element as HTMLInputElement).value,
      ).toBe('Treasury');
      expect(
        (wrapper.find('[data-testid="input-reviewer-group-description"]').element as HTMLTextAreaElement)
          .value,
      ).toBe('Treasury movements');
      expect(wrapper.text()).toContain('of 2');
      expect(
        (wrapper.find('[data-testid="input-reviewer-group-threshold"]').element as HTMLInputElement).value,
      ).toBe('2');
    });

    test('shows "Edit Reviewer Group" and a "Save Changes" submit label instead of the create copy', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);

      const wrapper = mountPage();
      await flushPromises();

      expect(wrapper.text()).toContain('Edit Reviewer Group');
      expect(wrapper.find('[data-testid="button-submit-create-reviewer-group"]').text()).toBe(
        'Save Changes',
      );
    });

    test('shows an error toast and navigates back when the group fails to load', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockRejectedValue(new Error('network down'));

      mountPage();
      await flushPromises();

      expect(mocks.toastError).toHaveBeenCalled();
      expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    });

    test('submits an update tagged with the group id and calls updateReviewerGroup instead of create', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);
      mocks.updateReviewerGroup.mockResolvedValue({});

      const wrapper = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="input-reviewer-group-description"]').setValue('Updated notes');

      expect(capture.callback).not.toBeNull();
      const result = await capture.callback!('my-password');

      expect(mocks.signReviewerPayload).toHaveBeenCalledWith(
        'local-user-id',
        'my-password',
        5,
        'org-public-key',
        {
          action: 'update',
          groupId: 7,
          name: 'Treasury',
          description: 'Updated notes',
          threshold: 2,
          members: [
            { userId: 2, userKeyId: 20, publicKey: 'public-key-2' },
            { userId: 3, userKeyId: 30, publicKey: 'public-key-3' },
          ],
        },
      );

      expect(mocks.updateReviewerGroup).toHaveBeenCalledWith('https://org.example.com', 7, {
        name: 'Treasury',
        description: 'Updated notes',
        threshold: 2,
        members: [
          { userId: 2, userKeyId: 20 },
          { userId: 3, userKeyId: 30 },
        ],
        userKeyId: 5,
        userSignature: 'deadbeef',
      });

      expect(mocks.createReviewerGroup).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Group update requested — pending member attestation',
      );
      expect(result).toBeNull();
    });

    test('clearing the description sends an explicit empty string, not undefined, since the back-end treats omitted fields as "unchanged"', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);
      mocks.updateReviewerGroup.mockResolvedValue({});

      const wrapper = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="input-reviewer-group-description"]').setValue('');

      await capture.callback!('my-password');

      expect(mocks.updateReviewerGroup).toHaveBeenCalledWith(
        'https://org.example.com',
        7,
        expect.objectContaining({ description: '' }),
      );
    });

    test('leave guard allows navigation when nothing has changed since load', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);

      mountPage();
      await flushPromises();

      const result = mocks.leaveGuard!({ fullPath: '/reviewer-groups' });

      expect(result).toBe(true);
    });

    test('leave guard blocks navigation once a loaded field is edited', async () => {
      mocks.route.params = { groupId: '7' };
      mocks.getReviewerGroup.mockResolvedValue(groupDetail);

      const wrapper = mountPage();
      await flushPromises();
      await wrapper.find('[data-testid="input-reviewer-group-name"]').setValue('Treasury Ops');

      const result = mocks.leaveGuard!({ fullPath: '/reviewer-groups' });

      expect(result).toBe(false);
    });
  });
});
