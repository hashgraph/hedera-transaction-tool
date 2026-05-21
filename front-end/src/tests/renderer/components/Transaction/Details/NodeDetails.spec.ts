// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import {
  AccountId,
  NodeCreateTransaction,
  NodeUpdateTransaction,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';
import Long from 'long';

import NodeDetails from '@renderer/components/Transaction/Details/NodeDetails.vue';

/**
 * HIP-1137 added an `associated_registered_node` field with two distinct
 * encodings:
 *
 *   - NodeCreate: a plain `repeated uint64`. The SDK getter always returns a
 *     `Long[]` (possibly empty) — there is no "unset" state on the wire.
 *
 *   - NodeUpdate: an `AssociatedRegisteredNodeList` wrapper. The wrapper's
 *     presence is what carries the intent:
 *       null   → wrapper absent       → "unchanged"
 *       []     → wrapper present, []  → "clear"
 *       [ids]  → wrapper present, ids → "replace"
 *
 * The details view has to render all three cases meaningfully — particularly
 * "unchanged" must NOT show up as `Cleared` or as an empty list, since users
 * need to be able to tell at a glance that the field wasn't touched.
 *
 * Each test round-trips the transaction through `Transaction.fromBytes` so the
 * object we render matches what the details view actually receives in
 * production (we display transactions parsed from server bytes, not the
 * in-memory builders).
 */

const nodeAccount = new AccountId(0, 0, 3);
const payerAccount = new AccountId(0, 0, 2);
const validStart = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

const baseFields = <T extends NodeCreateTransaction | NodeUpdateTransaction>(tx: T): T => {
  tx.setNodeAccountIds([nodeAccount]);
  tx.setTransactionId(TransactionId.withValidStart(payerAccount, validStart));
  return tx;
};

const roundTripCreate = (
  configure: (tx: NodeCreateTransaction) => NodeCreateTransaction,
): NodeCreateTransaction => {
  const frozen = configure(baseFields(new NodeCreateTransaction())).freeze();
  const parsed = Transaction.fromBytes(frozen.toBytes());
  if (!(parsed instanceof NodeCreateTransaction)) {
    throw new Error('round-trip did not produce a NodeCreateTransaction');
  }
  return parsed;
};

const roundTripUpdate = (
  configure: (tx: NodeUpdateTransaction) => NodeUpdateTransaction,
): NodeUpdateTransaction => {
  const built = configure(baseFields(new NodeUpdateTransaction().setNodeId(Long.fromNumber(3))));
  const frozen = built.freeze();
  const parsed = Transaction.fromBytes(frozen.toBytes());
  if (!(parsed instanceof NodeUpdateTransaction)) {
    throw new Error('round-trip did not produce a NodeUpdateTransaction');
  }
  return parsed;
};

const mountDetails = (transaction: Transaction) =>
  mount(NodeDetails, {
    props: { transaction, organizationTransaction: null },
    global: {
      stubs: { KeyStructureModal: true },
    },
  });

const findRow = (wrapper: ReturnType<typeof mountDetails>, label: string) =>
  wrapper
    .findAll('h4')
    .find(h => h.text() === label)
    ?.element.parentElement ?? null;

const findAssociatedRow = (wrapper: ReturnType<typeof mountDetails>) =>
  findRow(wrapper, 'Associated Registered Nodes');

describe('NodeDetails.vue — associatedRegisteredNodes', () => {
  describe('NodeCreate', () => {
    it('renders "None" when the list is empty (the wire default for NodeCreate)', () => {
      // No setAssociatedRegisteredNodes() call → SDK exposes `[]`. We still
      // surface the row, with the explicit "None" so the absence is visible
      // rather than hidden.
      const tx = roundTripCreate(t => t);
      expect(tx.associatedRegisteredNodes).toEqual([]);

      const wrapper = mountDetails(tx);
      const row = findAssociatedRow(wrapper);
      expect(row).not.toBeNull();
      expect(row?.textContent).toContain('None');
      expect(
        wrapper.find('[data-testid="p-node-details-associated-registered-nodes"]').text(),
      ).toBe('None');
    });

    it('renders a formatted list with the strategy compacting consecutive ids into ranges', () => {
      // 1, 5, 10, 11, 12, 13, 14, 15 → "1, 5, 10-15"
      const tx = roundTripCreate(t =>
        t.setAssociatedRegisteredNodes([1, 5, 10, 11, 12, 13, 14, 15]),
      );

      const wrapper = mountDetails(tx);
      const cell = wrapper.find('[data-testid="p-node-details-associated-registered-nodes"]');
      expect(cell.exists()).toBe(true);
      expect(cell.text()).toBe('1, 5, 10-15');
      expect(cell.text()).not.toContain('None');
      expect(cell.text()).not.toContain('Cleared');
    });
  });

  describe('NodeUpdate', () => {
    it('OMITS the row entirely when the wrapper is absent ("unchanged")', () => {
      // No setAssociatedRegisteredNodes() call on a NodeUpdate → SDK keeps the
      // field as null → wrapper not serialized → after decode it stays null.
      // This is the "do not touch" signal, and the details page must reflect
      // that by not showing the row at all (otherwise a user can't distinguish
      // unchanged from cleared).
      const tx = roundTripUpdate(t => t);
      expect(tx.associatedRegisteredNodes).toBeNull();

      const wrapper = mountDetails(tx);
      expect(findAssociatedRow(wrapper)).toBeNull();
      expect(wrapper.text()).not.toContain('Associated Registered Nodes');
      expect(
        wrapper.find('[data-testid="p-node-details-associated-registered-nodes"]').exists(),
      ).toBe(false);
    });

    it('renders "Cleared" when the wrapper is present with an empty array', () => {
      // setAssociatedRegisteredNodes([]) → wrapper serialized with no entries
      // → decoded as []. The semantic on the wire is "replace existing list
      // with empty", which we surface as "Cleared".
      const tx = roundTripUpdate(t => t.setAssociatedRegisteredNodes([]));
      expect(tx.associatedRegisteredNodes).toEqual([]);

      const wrapper = mountDetails(tx);
      const cell = wrapper.find('[data-testid="p-node-details-associated-registered-nodes"]');
      expect(cell.exists()).toBe(true);
      expect(cell.text()).toBe('Cleared');
      expect(cell.text()).not.toContain('None');
    });

    it('renders the formatted list when the wrapper carries values', () => {
      const tx = roundTripUpdate(t => t.setAssociatedRegisteredNodes([3, 4, 5, 9]));

      const wrapper = mountDetails(tx);
      const cell = wrapper.find('[data-testid="p-node-details-associated-registered-nodes"]');
      expect(cell.exists()).toBe(true);
      // 3-5 is a consecutive run; 9 stands alone.
      expect(cell.text()).toBe('3-5, 9');
    });
  });
});
