// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import DeleteRuleModal from '@renderer/components/ReviewerGroups/DeleteRuleModal.vue';
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
    template: '<div data-testid="stub-action-controller" :data-activate="activate" />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      serverUrl: 'https://org.example.com',
      userKeys: [{ id: 5, publicKey: 'org-public-key' }],
    },
    keyPairs: [{ public_key: 'org-public-key' }],
  },
  deleteReviewerRule: vi.fn(),
  resolveReviewerSigningKey: vi.fn(),
  signReviewerPayload: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/services/organization', () => ({
  deleteReviewerRule: mocks.deleteReviewerRule,
}));

vi.mock('@renderer/components/ReviewerGroups/signReviewerPayload', () => ({
  resolveReviewerSigningKey: mocks.resolveReviewerSigningKey,
  signReviewerPayload: mocks.signReviewerPayload,
}));

vi.mock('@renderer/utils', () => ({
  assertUserLoggedIn: vi.fn(),
  assertIsLoggedInOrganization: vi.fn(),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
    })),
  },
}));

function mountModal(props: { show?: boolean; ruleId?: number; ruleLabel?: string } = {}) {
  return mount(DeleteRuleModal, {
    props: { show: true, ruleId: 1, ruleLabel: '0.0.1234', ...props },
    global: {
      stubs: {
        AppModal: { props: ['show'], template: '<div v-if="show"><slot /></div>' },
        AppButton: {
          props: ['disabled'],
          template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
      },
    },
  });
}

describe('DeleteRuleModal.vue', () => {
  beforeEach(() => {
    capture.callback = null;
    mocks.deleteReviewerRule.mockReset();
    mocks.resolveReviewerSigningKey.mockReset();
    mocks.resolveReviewerSigningKey.mockReturnValue({ orgKeyId: 5, orgKeyPublicKey: 'org-public-key' });
    mocks.signReviewerPayload.mockReset();
    mocks.signReviewerPayload.mockResolvedValue({ userKeyId: 5, userSignature: 'deadbeef' });
    mocks.toastSuccess.mockClear();
  });

  test('renders the rule label in the confirmation text', () => {
    const wrapper = mountModal({ ruleLabel: '0.0.1234' });

    expect(wrapper.text()).toContain('Are you sure you want to delete the rule for "0.0.1234"?');
  });

  test('clicking Cancel emits update:show false without deleting', async () => {
    const wrapper = mountModal();

    const cancelButton = wrapper.findAll('button').find(b => b.text() === 'Cancel');
    await cancelButton?.trigger('click');

    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
    expect(mocks.deleteReviewerRule).not.toHaveBeenCalled();
  });

  test('clicking Remove activates the ActionController without deleting yet', async () => {
    const wrapper = mountModal();

    expect(wrapper.find('[data-testid="stub-action-controller"]').attributes('data-activate')).toBe('false');

    await wrapper.find('[data-testid="button-confirm-delete-reviewer-rule"]').trigger('click');

    expect(wrapper.find('[data-testid="stub-action-controller"]').attributes('data-activate')).toBe('true');
    expect(mocks.deleteReviewerRule).not.toHaveBeenCalled();
  });

  test('returns the ActionReport early when no signing key is available, without signing or posting', async () => {
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    mountModal();
    expect(capture.callback).not.toBeNull();

    const result = await capture.callback!('password');

    expect(result).toBe(report);
    expect(mocks.signReviewerPayload).not.toHaveBeenCalled();
    expect(mocks.deleteReviewerRule).not.toHaveBeenCalled();
  });

  test('signs the delete payload, posts it, toasts, emits deleted, and closes the modal', async () => {
    mocks.deleteReviewerRule.mockResolvedValue({});

    const wrapper = mountModal({ ruleId: 42, ruleLabel: '0.0.1234' });
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
      { action: 'delete', ruleId: 42 },
    );

    expect(mocks.deleteReviewerRule).toHaveBeenCalledWith('https://org.example.com', 42, {
      userKeyId: 5,
      userSignature: 'deadbeef',
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Rule deletion requested — pending member attestation');
    expect(wrapper.emitted('deleted')).toHaveLength(1);
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false]);
    expect(result).toBeNull();
  });
});
