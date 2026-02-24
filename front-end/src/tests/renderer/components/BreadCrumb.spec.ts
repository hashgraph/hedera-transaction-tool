// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import BreadCrumb from '@renderer/components/BreadCrumb.vue';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2';
import { useRouter } from 'vue-router';

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
}));

describe('BreadCrumb.vue', () => {
  let mockRouter: any;

  beforeEach(() => {
    mockRouter = {
      back: vi.fn(),
      push: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);
  });

  it('renders breadcrumb items from contextStack', () => {
    const wrapper = mount(BreadCrumb, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: ['Level 1', 'Level 2', 'Level 3'],
              },
            },
          }),
        ],
      },
    });

    const items = wrapper.findAll('[data-testid^="breadcrumb-item-"]');
    expect(items).toHaveLength(3);
    expect(items[0].text()).toBe('Level 1');
    expect(items[1].text()).toBe('Level 2');
    expect(items[2].text()).toBe('Level 3');
  });

  it('truncates long breadcrumb items', () => {
    const longItem = 'A'.repeat(51);
    const expectedTruncated = 'A'.repeat(50) + '…';

    const wrapper = mount(BreadCrumb, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: [longItem],
              },
            },
          }),
        ],
      },
    });

    const item = wrapper.find('[data-testid="breadcrumb-item-0"]');
    expect(item.text()).toBe(expectedTruncated);
  });

  it('renders leaf prop', () => {
    const wrapper = mount(BreadCrumb, {
      props: {
        leaf: 'Account Update Transaction',
      },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: ['History'],
              },
            },
          }),
        ],
      },
    });

    const items = wrapper.findAll('[data-testid^="breadcrumb-item-"]');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe('History');
    expect(items[1].text()).toBe('Account Update Transaction');
    expect(items[1].element.tagName).toBe('H2');
  });

  it('calls routeUp when a breadcrumb item is clicked', async () => {
    const wrapper = mount(BreadCrumb, {
      props: {
        leaf: 'Account Update Transaction',
      },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: ['History', 'Group of 42 Account Update Transactions'],
              },
            },
          }),
        ],
      },
    });

    const nextTransaction = useNextTransactionV2();
    // In stubActions: true mode, routeUp is already a mock
    const routeUpSpy = nextTransaction.routeUp;

    // Click on "History" (index 0)
    // contextStack has 2 items: History(0), Group of 42 Account Update Transactions(1)
    // nbLevelsUp = 2 - 0 = 2
    await wrapper.find('[data-testid="breadcrumb-item-0"]').trigger('click');

    expect(routeUpSpy).toHaveBeenCalledWith(mockRouter, 2);
  });

  it('renders separators correctly', () => {
    const wrapper = mount(BreadCrumb, {
      props: {
        leaf: 'Account Update Transaction',
      },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: ['History', 'Group of 42 Transactions'],
              },
            },
          }),
        ],
      },
    });

    const separators = wrapper.findAll('.item-separator');
    // History -> Sub -> Leaf
    // Separator between History and Sub, and between Sub and Leaf
    expect(separators).toHaveLength(2);
    expect(separators[0].text()).toBe('→');
    expect(wrapper.text()).toBe('History→Group of 42 Transactions→Account Update Transaction');
  });

  it('renders no separator if only one item and no leaf', () => {
    const wrapper = mount(BreadCrumb, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: ['History'],
              },
            },
          }),
        ],
      },
    });

    const separators = wrapper.findAll('.item-separator');
    expect(separators).toHaveLength(0);
    expect(wrapper.text()).toBe('History');
  });

  it('renders no separator if only leaf is provided', () => {
    const wrapper = mount(BreadCrumb, {
      props: {
        leaf: 'Account Update Transaction',
      },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              navigationController: {
                contextStack: [],
              },
            },
          }),
        ],
      },
    });

    const separators = wrapper.findAll('.item-separator');
    expect(separators).toHaveLength(0);
    expect(wrapper.text()).toBe('Account Update Transaction');
  });
});
