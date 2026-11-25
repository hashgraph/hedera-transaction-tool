/* eslint-disable */

/**
 * Flow tests: a cached account changes -> AccountCacheService publishes an update event
 * -> ReceiverService turns that event into notifications.
 *
 * Both services are the real implementations. Only the edges are mocked: the database
 * (entity manager / cache data source), the mirror node, the NATS publisher, and the
 * outgoing notification emitters (which are asserted on). `keysRequiredToSign` is mocked
 * to control who the required signers are before and after the "cache change".
 */

import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { AccountId, PrivateKey } from '@hiero-ledger/sdk';

import {
  AccountCacheService,
  AccountInfoParsed,
  keysRequiredToSign,
  MirrorNodeClient,
  NodeCacheService,
  NodeInfoParsed,
  NotificationEventDto,
  serializeKey,
  SqlBuilderService,
  TransactionSignatureService,
  TRANSACTION_EVENT_TYPE,
  TRANSACTION_UPDATE,
} from '@app/common';
import { NatsPublisherService } from '@app/common/nats/nats.publisher';
import {
  CachedAccount,
  CachedNode,
  Notification,
  NotificationReceiver,
  NotificationType,
  TransactionObserver,
  TransactionReviewerListMember,
  Transaction,
  TransactionStatus,
  User,
} from '@entities';

import { MessageValidator } from '../consumer/message-validator.util';
import { ReceiverService } from './receiver.service';
import {
  emitDeleteNotifications,
  emitEmailNotifications,
  emitNewNotifications,
  emitNotifyClients,
} from './emit-notifications';

jest.mock('./emit-notifications', () => ({
  emitDeleteNotifications: jest.fn(),
  emitEmailNotifications: jest.fn(),
  emitNewNotifications: jest.fn(),
  emitNotifyClients: jest.fn(),
}));

// Replace only keysRequiredToSign. A Proxy (instead of spreading the module) keeps every other
// export resolving lazily from the real module, so the real cache service keeps working.
jest.mock('@app/common', () => {
  const actual = jest.requireActual('@app/common');
  const keysRequiredToSignMock = jest.fn();
  return new Proxy(actual, {
    get: (target, prop, receiver) =>
      prop === 'keysRequiredToSign' ? keysRequiredToSignMock : Reflect.get(target, prop, receiver),
  });
});

const TX_ID = 7;

describe('Signer change notifications (cache change -> notifications)', () => {
  let receiver: ReceiverService;
  let cache: AccountCacheService;
  let nodeCache: NodeCacheService;

  // receiver side mocks
  let em: any;
  let transaction: any;
  let rowLocks: Map<number, Promise<void>>;
  let existingNotifications: any[];
  let nextNotificationId: number;
  let users: Record<number, any>;

  // cache side mocks
  let cachePublisher: { publish: jest.Mock };
  let cacheManager: { find: jest.Mock; findOne: jest.Mock };
  let cacheHelper: { tryClaimRefresh: jest.Mock; saveAndReleaseClaim: jest.Mock; replaceKeys: jest.Mock };
  let mirrorNodeClient: { fetchAccountInfo: jest.Mock; fetchNodeInfo: jest.Mock };

  const oldKey = PrivateKey.generateED25519().publicKey;
  const newKey = PrivateKey.generateED25519().publicKey;

  const makeUser = (id: number, opts: { email?: boolean; inApp?: boolean } = {}) => ({
    id,
    email: `user${id}@example.com`,
    notificationPreferences: [
      {
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        email: opts.email ?? true,
        inApp: opts.inApp ?? true,
      },
      { type: NotificationType.TRANSACTION_INDICATOR_SIGN, email: false, inApp: opts.inApp ?? true },
    ],
  });

  const requiredSigners = (...userIds: number[]) =>
    (keysRequiredToSign as jest.Mock).mockResolvedValue(
      userIds.map(id => ({ userId: id, user: { id } })),
    );

  const indicator = (receivers: { id: number; userId: number }[]) => ({
    id: 10,
    type: NotificationType.TRANSACTION_INDICATOR_SIGN,
    entityId: TX_ID,
    notificationReceivers: receivers.map(r => ({ ...r, isRead: false })),
  });

  const signEmail = (receivers: { id: number; userId: number }[]) => ({
    id: 11,
    type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
    entityId: TX_ID,
    notificationReceivers: receivers.map(r => ({ ...r, isRead: false })),
  });

  /** Send events through the real NATS encoding (JSON) and the consumer's validation, as in production. */
  const overTheWire = async (events: any[]) => {
    const msg = {
      subject: TRANSACTION_UPDATE,
      data: new TextEncoder().encode(JSON.stringify(events)),
    } as any;
    const parsed = await MessageValidator.parseAndValidate(msg, NotificationEventDto, new Logger('flow-test'));
    return (parsed ?? []) as NotificationEventDto[];
  };

  /** Refresh the cached account with a (changed or unchanged) key and return what the cache service published. */
  const refreshCachedAccount = async (opts: {
    previousKey: typeof oldKey | null;
    fetchedKey: typeof oldKey;
    linkedTransactionIds?: number[];
  }) => {
    const claimedAccount = {
      id: 1,
      account: '0.0.123',
      mirrorNetwork: 'testnet',
      refreshToken: 'token',
      encodedKey: opts.previousKey ? serializeKey(opts.previousKey) : null,
      receiverSignatureRequired: opts.previousKey ? false : null,
    } as unknown as CachedAccount;

    cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedAccount, claimed: true });
    cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
    mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
      data: { key: opts.fetchedKey, receiverSignatureRequired: false } as unknown as AccountInfoParsed,
      etag: 'etag',
    });
    cacheManager.find.mockResolvedValue(
      (opts.linkedTransactionIds ?? [TX_ID]).map(transactionId => ({ transactionId })),
    );

    await cache.refreshAccount(claimedAccount);

    return cachePublisher.publish.mock.calls.flatMap(call => call[1] as any[]);
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // ---- receiver side ----
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'withDeleted']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn();

    transaction = {
      id: TX_ID,
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      transactionId: '0.0.2@1700000000.000000000',
      mirrorNetwork: 'testnet',
      creatorKey: { userId: 1 },
      groupItem: null,
      deletedAt: null,
    };
    qb.getMany.mockImplementation(async () => [transaction]);

    existingNotifications = [];
    rowLocks = new Map();
    nextNotificationId = 900;
    users = { 2: makeUser(2), 3: makeUser(3), 9: makeUser(9) };

    em = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      // A row lock taken inside a transaction is held until it ends; a second locker waits
      transaction: jest.fn(async (cb: any) => {
        const held: Array<() => void> = [];
        const txEm = {
          ...em,
          findOne: jest.fn(async (_entity: any, opts: any) => {
            const id = opts.where.id;
            if (opts.lock) {
              const previous = rowLocks.get(id) ?? Promise.resolve();
              let release!: () => void;
              rowLocks.set(
                id,
                previous.then(() => new Promise<void>(resolve => (release = resolve))),
              );
              await previous;
              held.push(release);
            }
            return { id };
          }),
        };
        try {
          return await cb(txEm);
        } finally {
          held.forEach(release => release());
        }
      }),
      query: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(async (entity: any, opts: any) => {
        if (entity === TransactionObserver || entity === TransactionReviewerListMember) return [];
        if (entity === User) return Object.values(users);
        if (entity === Notification) {
          const types: NotificationType[] | undefined = opts?.where?.type?.value;
          return existingNotifications.filter(n => !types || types.includes(n.type));
        }
        return [];
      }),
      // Saves are reflected in what later lookups return, like a real database
      save: jest.fn(async (entity: any, data: any) => {
        if (entity === NotificationReceiver) {
          return (data as any[]).map(d => {
            const saved = { id: 1000 + d.userId, ...d };
            const owner = existingNotifications.find(n => n.id === d.notificationId);
            if (owner) owner.notificationReceivers.push({ id: saved.id, userId: d.userId, isRead: false });
            return saved;
          });
        }
        const saved = { id: nextNotificationId++, ...data, notificationReceivers: [] };
        if (entity === Notification) existingNotifications.push(saved);
        return saved;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReceiverService,
        { provide: EntityManager, useValue: em },
        { provide: TransactionSignatureService, useValue: {} },
        { provide: NatsPublisherService, useValue: { publish: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(false) } },
      ],
    }).compile();
    receiver = module.get(ReceiverService);

    // ---- cache side ----
    cachePublisher = { publish: jest.fn().mockResolvedValue({ success: true }) };
    cacheManager = { find: jest.fn(), findOne: jest.fn() };
    cacheHelper = {
      tryClaimRefresh: jest.fn(),
      saveAndReleaseClaim: jest.fn(),
      replaceKeys: jest.fn().mockResolvedValue(undefined),
    };
    mirrorNodeClient = { fetchAccountInfo: jest.fn(), fetchNodeInfo: jest.fn() };

    const linkQuery: any = {};
    for (const m of ['insert', 'into', 'values', 'orIgnore']) linkQuery[m] = jest.fn().mockReturnValue(linkQuery);
    linkQuery.execute = jest.fn().mockResolvedValue(undefined);
    const cacheDataSource = {
      manager: cacheManager,
      createQueryBuilder: jest.fn().mockReturnValue(linkQuery),
    } as any;
    const cacheConfig = { get: jest.fn((_k: string, d: unknown) => d) } as unknown as ConfigService;

    cache = new AccountCacheService(
      mirrorNodeClient as unknown as MirrorNodeClient,
      cacheDataSource,
      cacheConfig,
      {} as SqlBuilderService,
      cachePublisher as unknown as NatsPublisherService,
    );
    (cache as any).cacheHelper = cacheHelper;

    nodeCache = new NodeCacheService(
      mirrorNodeClient as unknown as MirrorNodeClient,
      cacheDataSource,
      cacheConfig,
      {} as SqlBuilderService,
      cachePublisher as unknown as NatsPublisherService,
    );
    (nodeCache as any).cacheHelper = cacheHelper;
  });

  // -------------------------------------------------------------------------

  describe('when the cached key of an account changes', () => {
    it('notifies a newly required signer (in-app and email) and leaves existing signers alone', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3); // user 3 owns the new key

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      expect(events).toEqual([{ entityId: TX_ID, additionalData: { signersChanged: true } }]);

      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      // in-app indicator only for the new signer
      expect(emitNewNotifications).toHaveBeenCalledTimes(1);
      const inApp = (emitNewNotifications as jest.Mock).mock.calls[0][1];
      expect(inApp).toHaveLength(1);
      expect(inApp[0].userId).toBe(3);
      expect(inApp[0].notificationReceivers[0]).toEqual(expect.objectContaining({ userId: 3 }));

      // email only for the new signer, with the "waiting for signatures" content
      expect(emitEmailNotifications).toHaveBeenCalledTimes(1);
      const emails = (emitEmailNotifications as jest.Mock).mock.calls[0][1];
      expect(emails).toHaveLength(1);
      expect(emails[0].email).toBe('user3@example.com');
      expect(emails[0].notifications[0].type).toBe(NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES);

      // the existing signer's notifications are untouched
      expect(emitDeleteNotifications).not.toHaveBeenCalled();
      expect(em.delete).not.toHaveBeenCalled();

      // websocket refresh goes to everyone currently required, including the new signer
      const pinged = (emitNotifyClients as jest.Mock).mock.calls[0][1].map((d: any) => d.userId).sort();
      expect(pinged).toEqual([2, 3]);
      expect((emitNotifyClients as jest.Mock).mock.calls[0][1][0].eventType).toBe(TRANSACTION_EVENT_TYPE.UPDATE);
    });

    it('clears the in-app indicator of a signer who is no longer required, and sends no new notifications', async () => {
      existingNotifications = [
        indicator([
          { id: 1, userId: 2 },
          { id: 5, userId: 9 },
        ]),
        signEmail([
          { id: 2, userId: 2 },
          { id: 6, userId: 9 },
        ]),
      ];
      requiredSigners(2); // user 9's key was replaced

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      expect(em.delete).toHaveBeenCalledTimes(1);
      expect(emitDeleteNotifications).toHaveBeenCalledWith(expect.anything(), [
        { userId: 9, notificationReceiverIds: [5] },
      ]);
      // sent emails cannot be unsent, and nobody new is notified
      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
    });

    it('respects preferences: a new signer with email off gets the in-app indicator but no email', async () => {
      users[3] = makeUser(3, { email: false });
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      expect((emitNewNotifications as jest.Mock).mock.calls[0][1][0].userId).toBe(3);
      expect(emitEmailNotifications).not.toHaveBeenCalled();
    });

    it('does not re-notify a signer who already read or acted on their notification', async () => {
      // user 2 signed earlier: the indicator is marked read, but the receiver row still exists
      existingNotifications = [
        {
          ...indicator([{ id: 1, userId: 2 }]),
          notificationReceivers: [{ id: 1, userId: 2, isRead: true }],
        },
        signEmail([{ id: 2, userId: 2 }]),
      ];
      requiredSigners(2, 3);

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      const notifiedUsers = (emitNewNotifications as jest.Mock).mock.calls.flatMap(c => c[1].map((d: any) => d.userId));
      expect(notifiedUsers).toEqual([3]);
    });

    it('does nothing for a transaction that can no longer be signed', async () => {
      transaction.status = TransactionStatus.EXECUTED;
      requiredSigners(2, 3);

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
      expect(emitDeleteNotifications).not.toHaveBeenCalled();
    });

    it('covers a transaction that is ready for execution', async () => {
      transaction.status = TransactionStatus.WAITING_FOR_EXECUTION;
      existingNotifications = [
        {
          id: 12,
          type: NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
          entityId: TX_ID,
          notificationReceivers: [{ id: 1, userId: 2, isRead: false }],
        },
      ];
      requiredSigners(2, 3);
      users[3] = makeUser(3, { email: false });

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      expect((emitNewNotifications as jest.Mock).mock.calls[0][1][0].userId).toBe(3);
    });
  });

  // -------------------------------------------------------------------------

  describe('over the wire and through other cache paths', () => {
    it('the signersChanged flag survives the NATS encoding and the consumer validation', async () => {
      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });

      const received = await overTheWire(events);

      expect(received).toHaveLength(1);
      expect(received[0].entityId).toBe(TX_ID);
      expect(received[0].additionalData).toEqual({ signersChanged: true });
    });

    it('an API read that refreshes a stale account announces the change, so a new signer is notified', async () => {
      // the account is cached with the old key but stale, so the read refetches it
      const staleRow = {
        id: 1,
        account: '0.0.123',
        mirrorNetwork: 'testnet',
        refreshToken: null,
        encodedKey: serializeKey(oldKey),
        receiverSignatureRequired: false,
        updatedAt: new Date(0),
      } as unknown as CachedAccount;
      cacheManager.findOne.mockResolvedValue(staleRow);
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: staleRow, claimed: true });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      mirrorNodeClient.fetchAccountInfo.mockResolvedValue({
        data: { key: newKey, receiverSignatureRequired: false } as unknown as AccountInfoParsed,
        etag: 'etag',
      });
      cacheManager.find.mockResolvedValue([{ transactionId: TX_ID }]);
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);

      await cache.getAccountInfoForTransaction({ id: TX_ID, mirrorNetwork: 'testnet' } as Transaction, '0.0.123');

      const events = cachePublisher.publish.mock.calls.flatMap(call => call[1] as any[]);
      expect(events).toEqual([{ entityId: TX_ID, additionalData: { signersChanged: true } }]);

      await receiver.processTransactionUpdateNotifications(await overTheWire(events));
      expect((emitNewNotifications as jest.Mock).mock.calls[0][1][0].userId).toBe(3);
    });

    it('a changed node admin key announces the change, so a new signer is notified', async () => {
      const claimedNode = {
        id: 1,
        nodeId: 3,
        mirrorNetwork: 'testnet',
        refreshToken: 'token',
        encodedKey: serializeKey(oldKey),
        nodeAccountId: '0.0.3',
      } as unknown as CachedNode;
      cacheHelper.tryClaimRefresh.mockResolvedValue({ data: claimedNode, claimed: true });
      cacheHelper.saveAndReleaseClaim.mockResolvedValue(1);
      mirrorNodeClient.fetchNodeInfo.mockResolvedValue({
        data: { admin_key: newKey, node_account_id: AccountId.fromString('0.0.3') } as unknown as NodeInfoParsed,
        etag: 'etag',
      });
      cacheManager.find.mockResolvedValue([{ transactionId: TX_ID }]);
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);

      await nodeCache.refreshNode(claimedNode);

      const events = cachePublisher.publish.mock.calls.flatMap(call => call[1] as any[]);
      expect(events).toEqual([{ entityId: TX_ID, additionalData: { signersChanged: true } }]);

      await receiver.processTransactionUpdateNotifications(await overTheWire(events));
      expect((emitNewNotifications as jest.Mock).mock.calls[0][1][0].userId).toBe(3);
      expect((emitEmailNotifications as jest.Mock).mock.calls[0][1][0].email).toBe('user3@example.com');
    });
  });

  // -------------------------------------------------------------------------

  describe('repeated and overlapping announcements', () => {
    it('notifies a new signer only once when the same change is announced twice', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);
      const events = await overTheWire(
        await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey }),
      );

      await receiver.processTransactionUpdateNotifications(events);
      await receiver.processTransactionUpdateNotifications(events);

      const notifiedUsers = (emitNewNotifications as jest.Mock).mock.calls.flatMap(c => c[1].map((d: any) => d.userId));
      expect(notifiedUsers).toEqual([3]);
      expect(emitEmailNotifications).toHaveBeenCalledTimes(1);
    });

    it('notifies a new signer only once when two changed accounts of the same transaction are announced in one batch', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);
      const flagged = { entityId: TX_ID, additionalData: { signersChanged: true } };

      await receiver.processTransactionUpdateNotifications(await overTheWire([flagged, flagged]));

      const notifiedUsers = (emitNewNotifications as jest.Mock).mock.calls.flatMap(c => c[1].map((d: any) => d.userId));
      expect(notifiedUsers).toEqual([3]);
      expect(emitEmailNotifications).toHaveBeenCalledTimes(1);
    });

    it('notifies a new signer only once when the same change is handled by two replicas at once', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);
      const events = await overTheWire(
        await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey }),
      );

      await Promise.all([
        receiver.processTransactionUpdateNotifications(events),
        receiver.processTransactionUpdateNotifications(events),
      ]);

      const notifiedUsers = (emitNewNotifications as jest.Mock).mock.calls.flatMap(c => c[1].map((d: any) => d.userId));
      expect(notifiedUsers).toEqual([3]);
      expect(emitEmailNotifications).toHaveBeenCalledTimes(1);
    });

    it('creates nothing for a new signer who has turned off every channel, even when announced repeatedly', async () => {
      users[3] = makeUser(3, { email: false, inApp: false });
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3);
      const events = await overTheWire(
        await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey }),
      );
      const saveCallsBefore = em.save.mock.calls.length;

      await receiver.processTransactionUpdateNotifications(events);
      await receiver.processTransactionUpdateNotifications(events);

      expect(em.save.mock.calls.length).toBe(saveCallsBefore);
      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
    });

    it('does not notify a new signer whose user has been soft-deleted', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      (keysRequiredToSign as jest.Mock).mockResolvedValue([
        { userId: 2, user: { id: 2, deletedAt: null } },
        { userId: 3, user: { id: 3, deletedAt: new Date() } },
      ]);

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: newKey });
      await receiver.processTransactionUpdateNotifications(await overTheWire(events));

      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------

  describe('when nothing relevant changes in the cache', () => {
    it('publishes no event when the refreshed account is unchanged, so no notifications go out', async () => {
      requiredSigners(2, 3);

      const events = await refreshCachedAccount({ previousKey: oldKey, fetchedKey: oldKey });

      expect(events).toEqual([]);
      expect(cachePublisher.publish).not.toHaveBeenCalled();
    });

    it('publishes no event for the first fetch of an account', async () => {
      const events = await refreshCachedAccount({ previousKey: null, fetchedKey: newKey });

      expect(events).toEqual([]);
    });

    it('publishes no event when the changed account is not linked to any transaction', async () => {
      const events = await refreshCachedAccount({
        previousKey: oldKey,
        fetchedKey: newKey,
        linkedTransactionIds: [],
      });

      expect(events).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------

  describe('ordinary notifications are unaffected', () => {
    it('an update without the signersChanged flag (e.g. a signature upload) only pings, never creates or deletes notifications', async () => {
      existingNotifications = [indicator([{ id: 1, userId: 2 }]), signEmail([{ id: 2, userId: 2 }])];
      requiredSigners(2, 3); // even though user 3 "looks" new, nothing announced a change

      await receiver.processTransactionUpdateNotifications([{ entityId: TX_ID } as any]);

      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
      expect(emitDeleteNotifications).not.toHaveBeenCalled();
      expect(em.transaction).not.toHaveBeenCalled();

      const pinged = (emitNotifyClients as jest.Mock).mock.calls[0][1].map((d: any) => d.userId).sort();
      expect(pinged).toEqual([2, 3]);
    });

    it('a status change still creates the indicator and email for every required signer and replaces the old indicators', async () => {
      // the transaction just moved to waiting for signatures; an indicator from the previous status exists
      existingNotifications = [
        {
          id: 20,
          type: NotificationType.TRANSACTION_INDICATOR_REVIEW,
          entityId: TX_ID,
          notificationReceivers: [{ id: 7, userId: 9, isRead: false }],
        },
      ];
      requiredSigners(2, 3);

      await receiver.processTransactionStatusUpdateNotifications([{ entityId: TX_ID } as any]);

      // old indicator receivers removed
      expect(emitDeleteNotifications).toHaveBeenCalledWith(expect.anything(), [
        { userId: 9, notificationReceiverIds: [7] },
      ]);

      // new indicator for both signers
      const inAppUsers = (emitNewNotifications as jest.Mock).mock.calls[0][1].map((d: any) => d.userId).sort();
      expect(inAppUsers).toEqual([2, 3]);

      // email for both signers
      const emailAddresses = (emitEmailNotifications as jest.Mock).mock.calls[0][1].map((d: any) => d.email).sort();
      expect(emailAddresses).toEqual(['user2@example.com', 'user3@example.com']);
      expect((emitEmailNotifications as jest.Mock).mock.calls[0][1][0].notifications[0].type).toBe(
        NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      );
    });
  });
});
