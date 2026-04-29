// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

describe('TransactionSelectionModal.vue', () => {
  test('displays all transaction categories and account transaction types', () => {
    const wrapper = mount(TransactionSelectionModal, {
      props: {
        show: true,
        'onUpdate:show': vi.fn(),
      },
      global: {
        mocks: {
          $router: {
            push: vi.fn(),
          },
        },
        stubs: {
          AppModal: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="menu-link-account"]').text()).toBe('Account');
    expect(wrapper.find('[data-testid="menu-link-file"]').text()).toBe('File');
    expect(wrapper.find('[data-testid="menu-link-node"]').text()).toBe('Node');
    expect(wrapper.find('[data-testid="menu-link-system"]').text()).toBe('System');
    expect(wrapper.text()).toContain('Create Account');
    expect(wrapper.text()).toContain('Update Account');
    expect(wrapper.text()).toContain('Delete Account');
    expect(wrapper.text()).toContain('Transfer Tokens');
    expect(wrapper.text()).toContain('Approve Allowance');
  });

  test('routes selected transaction type with group query', async () => {
    const router = {
      push: vi.fn(),
    };
    const wrapper = mount(TransactionSelectionModal, {
      props: {
        group: true,
        show: true,
        'onUpdate:show': vi.fn(),
      },
      global: {
        mocks: {
          $router: router,
        },
        stubs: {
          AppModal: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="menu-sub-link-accountcreatetransaction"]').trigger('click');

    expect(router.push).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'AccountCreateTransaction' },
      query: { group: 'true' },
    });
  });
});
