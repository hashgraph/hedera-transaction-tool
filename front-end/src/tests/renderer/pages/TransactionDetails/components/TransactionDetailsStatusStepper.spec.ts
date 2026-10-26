// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import { TransactionStatus, type ITransactionFull } from '@shared/interfaces';

import TransactionDetailsStatusStepper from '@renderer/pages/TransactionDetails/components/TransactionDetailsStatusStepper.vue';

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants');
  return { ...actual, FEATURE_REVIEWER_ENABLED: true };
});

const baseTransaction = {
  status: TransactionStatus.NEW,
  isManual: false,
  signers: [],
  observers: [],
} as unknown as ITransactionFull;

describe('TransactionDetailsStatusStepper.vue', () => {
  test('does not throw when approvers is undefined (back-end no longer sends it)', () => {
    expect(() =>
      mount(TransactionDetailsStatusStepper, {
        props: { transaction: { ...baseTransaction, approvers: undefined } },
      }),
    ).not.toThrow();
  });

  test('includes the Awaiting Approval step when reviewer lists are present', () => {
    const wrapper = mount(TransactionDetailsStatusStepper, {
      props: {
        transaction: {
          ...baseTransaction,
          reviewerLists: [{ id: 1, name: null, description: null, threshold: 1, members: [] }],
        },
      },
    });

    expect(wrapper.text()).toContain('Awaiting Approval');
  });

  test('omits the Awaiting Approval step when reviewerLists is undefined', () => {
    const wrapper = mount(TransactionDetailsStatusStepper, {
      props: { transaction: { ...baseTransaction, reviewerLists: undefined } },
    });

    expect(wrapper.text()).not.toContain('Awaiting Approval');
  });
});
