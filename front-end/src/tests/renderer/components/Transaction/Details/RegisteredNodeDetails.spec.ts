// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import {
  AccountId,
  BlockNodeApi,
  BlockNodeServiceEndpoint,
  GeneralServiceEndpoint,
  KeyList,
  MirrorNodeServiceEndpoint,
  PrivateKey,
  RegisteredNodeCreateTransaction,
  RegisteredNodeDeleteTransaction,
  RegisteredNodeUpdateTransaction,
  RpcRelayServiceEndpoint,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';
import Long from 'long';

import RegisteredNodeDetails from '@renderer/components/Transaction/Details/RegisteredNodeDetails.vue';

// Key reused across tests
const adminPrivKey = PrivateKey.generateED25519();
const adminPubKey = adminPrivKey.publicKey;

const payerAccount = new AccountId(0, 0, 2);
const validStart = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const txId = () => TransactionId.withValidStart(payerAccount, validStart);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roundTripCreate = (
  configure: (tx: RegisteredNodeCreateTransaction) => RegisteredNodeCreateTransaction,
): RegisteredNodeCreateTransaction => {
  const frozen = configure(
    new RegisteredNodeCreateTransaction().setTransactionId(txId()),
  ).freeze();
  const parsed = Transaction.fromBytes(frozen.toBytes());
  if (!(parsed instanceof RegisteredNodeCreateTransaction)) {
    throw new Error('round-trip did not produce a RegisteredNodeCreateTransaction');
  }
  return parsed;
};

const roundTripUpdate = (
  configure: (tx: RegisteredNodeUpdateTransaction) => RegisteredNodeUpdateTransaction,
): RegisteredNodeUpdateTransaction => {
  const frozen = configure(
    new RegisteredNodeUpdateTransaction()
      .setRegisteredNodeId(Long.fromNumber(42))
      .setTransactionId(txId()),
  ).freeze();
  const parsed = Transaction.fromBytes(frozen.toBytes());
  if (!(parsed instanceof RegisteredNodeUpdateTransaction)) {
    throw new Error('round-trip did not produce a RegisteredNodeUpdateTransaction');
  }
  return parsed;
};

const roundTripDelete = (
  configure: (tx: RegisteredNodeDeleteTransaction) => RegisteredNodeDeleteTransaction,
): RegisteredNodeDeleteTransaction => {
  const frozen = configure(
    new RegisteredNodeDeleteTransaction()
      .setRegisteredNodeId(Long.fromNumber(7))
      .setTransactionId(txId()),
  ).freeze();
  const parsed = Transaction.fromBytes(frozen.toBytes());
  if (!(parsed instanceof RegisteredNodeDeleteTransaction)) {
    throw new Error('round-trip did not produce a RegisteredNodeDeleteTransaction');
  }
  return parsed;
};

const mountDetails = (transaction: Transaction) =>
  mount(RegisteredNodeDetails, {
    props: { transaction, organizationTransaction: null },
    global: { stubs: { KeyStructureModal: true } },
  });

/** Find the container div whose h4 matches `label`. */
const findSection = (wrapper: ReturnType<typeof mountDetails>, label: string) =>
  wrapper.findAll('h4').find(h => h.text() === label)?.element.parentElement ?? null;

/** Return all <tr> elements inside the service-endpoints table body. */
const endpointRows = (wrapper: ReturnType<typeof mountDetails>) =>
  wrapper.findAll('tbody tr');

/** Return the text of each <td> in a given row. */
const rowCells = (row: ReturnType<typeof endpointRows>[number]) =>
  row.findAll('td').map(td => td.text().trim());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RegisteredNodeDetails.vue', () => {
  // -------------------------------------------------------------------------
  describe('RegisteredNodeCreateTransaction', () => {
    it('does not show a Registered Node ID section', () => {
      const tx = roundTripCreate(t => t);
      const wrapper = mountDetails(tx);
      expect(findSection(wrapper, 'Registered Node ID')).toBeNull();
      expect(wrapper.find('[data-testid="p-node-details-node-id"]').exists()).toBe(false);
    });

    // -----------------------------------------------------------------------
    describe('description', () => {
      it('shows the description when one is set', () => {
        const tx = roundTripCreate(t => t.setDescription('My test node'));
        const wrapper = mountDetails(tx);
        const el = wrapper.find('[data-testid="p-registered-node-details-description"]');
        expect(el.exists()).toBe(true);
        expect(el.text()).toBe('My test node');
      });

      it('hides the description section when none is set', () => {
        const tx = roundTripCreate(t => t);
        const wrapper = mountDetails(tx);
        expect(findSection(wrapper, 'Description')).toBeNull();
        expect(
          wrapper.find('[data-testid="p-registered-node-details-description"]').exists(),
        ).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('admin key', () => {
      it('hides the admin key section when no key is set', () => {
        const tx = roundTripCreate(t => t);
        const wrapper = mountDetails(tx);
        expect(findSection(wrapper, 'Admin Key')).toBeNull();
        expect(
          wrapper.find('[data-testid="p-registered-node-details-admin-key"]').exists(),
        ).toBe(false);
      });

      it('shows the raw public key value for a PublicKey admin key', () => {
        const tx = roundTripCreate(t => t.setAdminKey(adminPubKey));
        const wrapper = mountDetails(tx);
        const el = wrapper.find('[data-testid="p-registered-node-details-admin-key"]');
        expect(el.exists()).toBe(true);
        // toStringRaw() returns the hex-encoded public key bytes
        expect(el.text()).toContain(adminPubKey.toStringRaw());
        expect(el.text()).not.toContain('None');
        expect(el.text()).not.toContain('See details');
      });

      it('shows "See details" for a KeyList admin key', () => {
        const keyList = new KeyList([adminPubKey]);
        const tx = roundTripCreate(t => t.setAdminKey(keyList));
        const wrapper = mountDetails(tx);
        const el = wrapper.find('[data-testid="p-registered-node-details-admin-key"]');
        expect(el.exists()).toBe(true);
        expect(el.text()).toContain('See details');
        expect(el.text()).not.toContain('None');
      });
    });

    // -----------------------------------------------------------------------
    describe('service endpoints', () => {
      it('hides the service endpoints section when the list is empty', () => {
        const tx = roundTripCreate(t => t);
        const wrapper = mountDetails(tx);
        expect(findSection(wrapper, 'Service Endpoints')).toBeNull();
        expect(endpointRows(wrapper)).toHaveLength(0);
      });

      it('renders the correct type labels for all four endpoint types', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new BlockNodeServiceEndpoint().setIpAddress(new Uint8Array([1, 1, 1, 1])).setPort(50211).setRequiresTls(false),
            new MirrorNodeServiceEndpoint().setIpAddress(new Uint8Array([1, 1, 1, 2])).setPort(5600).setRequiresTls(false),
            new RpcRelayServiceEndpoint().setIpAddress(new Uint8Array([1, 1, 1, 3])).setPort(7546).setRequiresTls(false),
            new GeneralServiceEndpoint().setIpAddress(new Uint8Array([1, 1, 1, 4])).setPort(443).setRequiresTls(true),
          ]),
        );
        const wrapper = mountDetails(tx);
        const rows = endpointRows(wrapper);
        expect(rows).toHaveLength(4);
        expect(rowCells(rows[0])[0]).toBe('Block Node');
        expect(rowCells(rows[1])[0]).toBe('Mirror Node');
        expect(rowCells(rows[2])[0]).toBe('RPC Relay');
        expect(rowCells(rows[3])[0]).toBe('General Service');
      });

      it('renders IPv4 bytes as a dot-separated address (regression: not comma-separated)', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new BlockNodeServiceEndpoint()
              .setIpAddress(new Uint8Array([192, 168, 1, 100]))
              .setPort(50211)
              .setRequiresTls(false),
          ]),
        );
        const wrapper = mountDetails(tx);
        const cells = wrapper.findAll('td');
        const ipCell = cells.find(td => /^\d+\.\d+\.\d+\.\d+$/.test(td.text().trim()));
        expect(ipCell).toBeDefined();
        expect(ipCell!.text().trim()).toBe('192.168.1.100');
        expect(ipCell!.text()).not.toContain(',');
      });

      it('renders the domain name when no IP address is set', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new GeneralServiceEndpoint()
              .setDomainName('node.example.com')
              .setPort(443)
              .setRequiresTls(true),
          ]),
        );
        const wrapper = mountDetails(tx);
        expect(rowCells(endpointRows(wrapper)[0])[1]).toBe('node.example.com');
      });

      it('renders the port number', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new MirrorNodeServiceEndpoint()
              .setIpAddress(new Uint8Array([10, 0, 0, 1]))
              .setPort(5600)
              .setRequiresTls(false),
          ]),
        );
        const wrapper = mountDetails(tx);
        expect(rowCells(endpointRows(wrapper)[0])[2]).toBe('5600');
      });

      it('renders TLS as "Yes" when requiresTls is true', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new RpcRelayServiceEndpoint()
              .setIpAddress(new Uint8Array([10, 0, 0, 2]))
              .setPort(443)
              .setRequiresTls(true),
          ]),
        );
        const wrapper = mountDetails(tx);
        expect(rowCells(endpointRows(wrapper)[0])[3]).toBe('Yes');
      });

      it('renders TLS as "No" when requiresTls is false', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new MirrorNodeServiceEndpoint()
              .setIpAddress(new Uint8Array([10, 0, 0, 3]))
              .setPort(5600)
              .setRequiresTls(false),
          ]),
        );
        const wrapper = mountDetails(tx);
        expect(rowCells(endpointRows(wrapper)[0])[3]).toBe('No');
      });

      it('renders BlockNodeServiceEndpoint API labels in the last column', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new BlockNodeServiceEndpoint()
              .setIpAddress(new Uint8Array([10, 0, 0, 4]))
              .setPort(50211)
              .setRequiresTls(false)
              .setEndpointApis([BlockNodeApi.Status, BlockNodeApi.SubscribeStream]),
          ]),
        );
        const wrapper = mountDetails(tx);
        const apisCell = rowCells(endpointRows(wrapper)[0])[4];
        expect(apisCell).toContain('Status');
        expect(apisCell).toContain('Sub. Stream');
      });

      it('renders GeneralServiceEndpoint description in the last column', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new GeneralServiceEndpoint()
              .setDomainName('gw.example.com')
              .setPort(443)
              .setRequiresTls(true)
              .setDescription('Public gateway'),
          ]),
        );
        const wrapper = mountDetails(tx);
        expect(rowCells(endpointRows(wrapper)[0])[4]).toBe('Public gateway');
      });

      it('leaves the last column empty for MirrorNode and RpcRelay endpoints', () => {
        const tx = roundTripCreate(t =>
          t.setServiceEndpoints([
            new MirrorNodeServiceEndpoint().setIpAddress(new Uint8Array([1, 2, 3, 4])).setPort(443).setRequiresTls(false),
            new RpcRelayServiceEndpoint().setIpAddress(new Uint8Array([1, 2, 3, 5])).setPort(7546).setRequiresTls(false),
          ]),
        );
        const wrapper = mountDetails(tx);
        const rows = endpointRows(wrapper);
        expect(rowCells(rows[0])[4]).toBe('');
        expect(rowCells(rows[1])[4]).toBe('');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('RegisteredNodeUpdateTransaction', () => {
    it('shows the Registered Node ID', () => {
      const tx = roundTripUpdate(t => t);
      const wrapper = mountDetails(tx);
      const el = wrapper.find('[data-testid="p-node-details-node-id"]');
      expect(el.exists()).toBe(true);
      expect(el.text()).toBe('42');
    });

    it('shows description when set', () => {
      const tx = roundTripUpdate(t => t.setDescription('Updated description'));
      const wrapper = mountDetails(tx);
      const el = wrapper.find('[data-testid="p-registered-node-details-description"]');
      expect(el.exists()).toBe(true);
      expect(el.text()).toBe('Updated description');
    });

    it('shows service endpoints when set', () => {
      const tx = roundTripUpdate(t =>
        t.setServiceEndpoints([
          new GeneralServiceEndpoint()
            .setIpAddress(new Uint8Array([10, 0, 0, 5]))
            .setPort(8080)
            .setRequiresTls(false),
        ]),
      );
      const wrapper = mountDetails(tx);
      expect(endpointRows(wrapper)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('RegisteredNodeDeleteTransaction', () => {
    it('shows the Registered Node ID', () => {
      const tx = roundTripDelete(t => t);
      const wrapper = mountDetails(tx);
      const el = wrapper.find('[data-testid="p-node-details-node-id"]');
      expect(el.exists()).toBe(true);
      expect(el.text()).toBe('7');
    });

    it('does not show description, admin key, or service endpoints sections', () => {
      const tx = roundTripDelete(t => t);
      const wrapper = mountDetails(tx);
      expect(findSection(wrapper, 'Description')).toBeNull();
      expect(findSection(wrapper, 'Admin Key')).toBeNull();
      expect(findSection(wrapper, 'Service Endpoints')).toBeNull();
    });
  });
});
