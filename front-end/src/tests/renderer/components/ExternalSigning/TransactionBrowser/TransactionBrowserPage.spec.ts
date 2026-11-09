// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractId,
  Timestamp,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';

import TransactionBrowserPage from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserPage.vue';
import type { TransactionBrowserEntry } from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserEntry';

const txId = () =>
  TransactionId.withValidStart(
    AccountId.fromString('0.0.2'),
    Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  );

function entryFor(tx: { freeze: () => { toBytes: () => Uint8Array } }): TransactionBrowserEntry {
  const bytes = Buffer.from(tx.freeze().toBytes()).toString('hex');
  return {
    item: { name: 'tx', description: 'desc', transactionBytes: bytes, creatorEmail: 'a@b.c' },
  } as TransactionBrowserEntry;
}

function mountPage(entry: TransactionBrowserEntry) {
  return mount(TransactionBrowserPage, {
    props: { entries: [entry], show: true, currentIndex: 0 },
    global: {
      directives: { 'log-click': {} },
      stubs: {
        AppModal: { template: '<div><slot /></div>' },
        ContractExecuteDetails: {
          name: 'ContractExecuteDetails',
          props: ['transaction', 'organizationTransaction'],
          template: '<div data-testid="contract-execute-details-stub" />',
        },
        TransactionBrowserKeySection: true,
        TransferDetails: true,
      },
    },
  });
}

describe('TransactionBrowserPage.vue - contract execute', () => {
  test('renders ContractExecuteDetails for a ContractExecuteTransaction', () => {
    const tx = new ContractExecuteTransaction()
      .setTransactionId(txId())
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .setContractId(ContractId.fromString('0.0.1001'))
      .setGas(1000);
    const wrapper = mountPage(entryFor(tx));
    const details = wrapper.findComponent({ name: 'ContractExecuteDetails' });
    expect(details.exists()).toBe(true);
    expect(details.props('organizationTransaction')).toBeNull();
    expect(details.props('transaction')).toBeInstanceOf(ContractExecuteTransaction);
    expect(wrapper.text()).toContain('Contract Execute');
  });

  test('does not render ContractExecuteDetails for other transaction types', () => {
    const tx = new TransferTransaction()
      .setTransactionId(txId())
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .addHbarTransfer('0.0.2', -1)
      .addHbarTransfer('0.0.3', 1);
    const wrapper = mountPage(entryFor(tx));
    expect(wrapper.findComponent({ name: 'ContractExecuteDetails' }).exists()).toBe(false);
  });
});
