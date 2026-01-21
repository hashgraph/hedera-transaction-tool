import { Test } from '@nestjs/testing';
import { ReceiverService } from './receiver.service';
import { EntityManager, In } from 'typeorm';

import { TransactionSignatureService } from '@app/common';
import { NatsPublisherService } from '@app/common/nats/nats.publisher';

import {
  Notification,
  NotificationReceiver,
  NotificationType,
  Transaction,
  TransactionApprover,
  TransactionStatus,
  User,
  NOTIFICATION_CHANNELS,
} from '@entities';

import {
  emitDeleteNotifications,
  emitEmailNotifications,
  emitNewNotifications,
  emitNotifyClients,
} from './emit-notifications';

import { keysRequiredToSign } from '@app/common';

jest.mock('./emit-notifications', () => ({
  emitDeleteNotifications: jest.fn(),
  emitEmailNotifications: jest.fn(),
  emitNewNotifications: jest.fn(),
  emitNotifyClients: jest.fn(),
}));

jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  keysRequiredToSign: jest.fn(),
}));

const mockEntityManager = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
});

const mockTransactionSignatureService = () => ({
  someMethod: jest.fn(),
});

const mockPublisher = () => ({
  publish: jest.fn(),
});

describe('ReceiverService', () => {
  let service: ReceiverService;
  let em: ReturnType<typeof mockEntityManager>;
  let tss: ReturnType<typeof mockTransactionSignatureService>;
  let publisher: ReturnType<typeof mockPublisher>;

  beforeEach(async () => {
    em = mockEntityManager();
    tss = mockTransactionSignatureService();
    publisher = mockPublisher();

    // Make transaction execute the callback with our mock em
    em.transaction.mockImplementation(async (cb: any) => cb(em));

    const module = await Test.createTestingModule({
      providers: [
        ReceiverService,
        { provide: EntityManager, useValue: em },
        { provide: TransactionSignatureService, useValue: tss },
        { provide: NatsPublisherService, useValue: publisher },
      ],
    }).compile();

    service = module.get(ReceiverService);
    jest.clearAllMocks();
  });

  it('getInAppNotificationType and getEmailNotificationType cover all mapped statuses', () => {
    const inAppMap = (ReceiverService as any).IN_APP_NOTIFICATION_TYPES as Record<string, any>;
    for (const key of Object.keys(inAppMap)) {
      expect((service as any).getInAppNotificationType(key)).toBe(inAppMap[key]);
    }

    const emailMap = (ReceiverService as any).EMAIL_NOTIFICATION_TYPES as Record<string, any>;
    for (const key of Object.keys(emailMap)) {
      expect((service as any).getEmailNotificationType(key)).toBe(emailMap[key]);
    }
  });

  it('returns null when status is not mapped', () => {
    // use a value that is not present in the maps and cast to TransactionStatus
    const unknownStatus = (9999 as unknown) as TransactionStatus;

    expect((service as any).getInAppNotificationType(unknownStatus)).toBeNull();
    expect((service as any).getEmailNotificationType(unknownStatus)).toBeNull();


    expect((service as any).getInAppNotificationType(null)).toBeNull();
    expect((service as any).getEmailNotificationType(null)).toBeNull();
  });

  it('fetchTransactionsWithRelations returns map', async () => {
    const tx = { id: 1 } as any;
    em.find.mockResolvedValue([tx]);

    const result = await (service as any).fetchTransactionsWithRelations([1], false);
    expect(em.find).toHaveBeenCalledWith(Transaction, expect.any(Object));
    expect(result.get(1)).toBe(tx);
  });

  it('fetchTransactionsWithRelations uses default withDeleted = false when omitted', async () => {
    const tx = { id: 2 } as any;
    em.find.mockResolvedValueOnce([tx]);

    const result = await (service as any).fetchTransactionsWithRelations([2]); // omit second arg

    expect(em.find).toHaveBeenCalledWith(Transaction, expect.objectContaining({ withDeleted: false }));
    expect(result.get(2)).toBe(tx);
  });

  it('fetchTransactionsWithRelations forwards withDeleted = true when provided', async () => {
    const tx = { id: 3 } as any;
    em.find.mockResolvedValueOnce([tx]);

    const result = await (service as any).fetchTransactionsWithRelations([3], true);

    expect(em.find).toHaveBeenCalledWith(Transaction, expect.objectContaining({ withDeleted: true }));
    expect(result.get(3)).toBe(tx);
  });

  it('getApproversByTransactionIds groups approvers', async () => {
    em.query.mockResolvedValue([
      { id: 10, transactionId: 1, userId: 50 },
      { id: 11, transactionId: 1, userId: 51 },
      { id: 12, transactionId: 2, userId: 52 },
    ]);

    const result = await (service as any).getApproversByTransactionIds(em as any, [1, 2]);
    expect(result.get(1)!.length).toBe(2);
    expect(result.get(2)!.length).toBe(1);
  });

  it('getApproversByTransactionIds returns empty Map when transactionIds is empty', async () => {
    // ensure no DB calls are made for empty input
    em.query.mockClear();

    const result = await (service as any).getApproversByTransactionIds(em as any, []);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(em.query).not.toHaveBeenCalled();
  });

  it('getUsersIdsRequiredToSign calls keysRequiredToSign and dedups', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10, user: { id: 10 } },
      { userId: 10, user: { id: 10 } },
      { userId: 11, user: { id: 11 } },
    ]);
    const tx = {} as any;

    const res = await (service as any).getUsersIdsRequiredToSign(em as any, tx, new Map());
    expect(keysRequiredToSign).toHaveBeenCalled();
    expect(res).toEqual([10, 11]);
  });

  it('getUsersIdsRequiredToSign filters out soft-deleted users', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10, user: { id: 10, deletedAt: null } },
      { userId: 11, user: { id: 11, deletedAt: new Date() } }, // deleted user
      { userId: 12, user: { id: 12, deletedAt: null } },
    ]);
    const tx = {} as any;

    const res = await (service as any).getUsersIdsRequiredToSign(em as any, tx, new Map());
    expect(res).toEqual([10, 12]);
    expect(res).not.toContain(11);
  });

  it('getUsersIdsRequiredToSign filters out soft-deleted keys', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10, deletedAt: null, user: { id: 10, deletedAt: null } },
      { userId: 11, deletedAt: new Date(), user: { id: 11, deletedAt: null } }, // deleted key
      { userId: 12, deletedAt: null, user: { id: 12, deletedAt: null } },
    ]);
    const tx = {} as any;

    const res = await (service as any).getUsersIdsRequiredToSign(em as any, tx, new Map());
    expect(res).toEqual([10, 12]);
    expect(res).not.toContain(11);
  });

  it('getUsersIdsRequiredToSign filters out keys with missing user relation', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10, deletedAt: null, user: { id: 10, deletedAt: null } },
      { userId: 11, deletedAt: null, user: null }, // missing user (orphaned key)
      { userId: 12, deletedAt: null, user: { id: 12, deletedAt: null } },
    ]);
    const tx = {} as any;

    const res = await (service as any).getUsersIdsRequiredToSign(em as any, tx, new Map());
    expect(res).toEqual([10, 12]);
    expect(res).not.toContain(11);
  });

  it('getUsersIdsRequiredToSign filters out all inactive keys leaving empty result', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10, deletedAt: new Date(), user: { id: 10, deletedAt: null } }, // deleted key
      { userId: 11, deletedAt: null, user: { id: 11, deletedAt: new Date() } }, // deleted user
      { userId: 12, deletedAt: null, user: null }, // missing user
    ]);
    const tx = {} as any;

    const res = await (service as any).getUsersIdsRequiredToSign(em as any, tx, new Map());
    expect(res).toEqual([]);
  });

  it('getTransactionParticipants computes participants correctly', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 100, user: { id: 100 } }]);

    const tx: any = {
      creatorKey: { userId: 1 },
      signers: [{ userId: 2 }],
      observers: [{ userId: 3 }],
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
    };

    const approvers = [
      { userId: 4, approved: null } as TransactionApprover,
      { userId: 5, approved: true } as TransactionApprover,
    ];

    const result = await (service as any).getTransactionParticipants(em as any, tx, approvers, new Map());
    expect(result.participants).toEqual(expect.arrayContaining([1, 2, 3, 4, 100]));
    expect(result.requiredUserIds).toEqual([100]);
  });

  it('getTransactionParticipants yields empty approversShouldChooseUserIds when status is not waiting', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 100, user: { id: 100 } }]);

    const tx: any = {
      creatorKey: { userId: 1 },
      signers: [{ userId: 2 }],
      observers: [{ userId: 3 }],
      status: TransactionStatus.EXECUTED, // not in waiting set
    };

    const approvers: any[] = [
      { userId: 4, approved: null },
      { userId: 5, approved: null },
    ];

    const res = await (service as any).getTransactionParticipants(em as any, tx, approvers, new Map());
    expect(res.approversShouldChooseUserIds).toEqual([]);
  });

  it('getTransactionParticipants yields empty approversShouldChooseUserIds when no approver is pending (all approved !== null) even if status is waiting', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 200, user: { id: 200 } }]);

    const tx: any = {
      creatorKey: { userId: 1 },
      signers: [{ userId: 2 }],
      observers: [{ userId: 3 }],
      status: TransactionStatus.WAITING_FOR_SIGNATURES, // in waiting set
    };

    const approvers: any[] = [
      { userId: 4, approved: true },
      { userId: 5, approved: false }, // explicitly not null
      { userId: null, approved: true }, // falsy userId should be filtered out
    ];

    const res = await (service as any).getTransactionParticipants(em as any, tx, approvers, new Map());
    expect(res.approversShouldChooseUserIds).toEqual([]);
  });

  describe('getNotificationReceiverIds', () => {
    const participantsMock = {
      approversUserIds: [2, 3],
      approversShouldChooseUserIds: [4],
      observerUserIds: [5],
      requiredUserIds: [6, 7],
      creatorId: 1,
      // other fields are ignored by the function under test
    };

    beforeEach(() => {
      jest
        .spyOn(service as any, 'getTransactionParticipants')
        .mockResolvedValue(participantsMock);
    });

    it('returns creator + approvers + observers for APPROVAL_REJECTION / INDICATOR_REJECTED', async () => {
      const resA = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_APPROVAL_REJECTION,
        [] as any,
      );
      expect(resA).toEqual([1, 2, 3, 5]);

      const resB = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_INDICATOR_REJECTED,
        [] as any,
      );
      expect(resB).toEqual([1, 2, 3, 5]);
    });

    it('returns approversShouldChooseUserIds for APPROVED / INDICATOR_APPROVE', async () => {
      const res = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_APPROVED,
        [] as any,
      );
      expect(res).toEqual([4]);

      const res2 = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_INDICATOR_APPROVE,
        [] as any,
      );
      expect(res2).toEqual([4]);
    });

    it('returns requiredUserIds for WAITING_FOR_SIGNATURES and reminder variants / INDICATOR_SIGN', async () => {
      const types = [
        NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
        NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL,
        NotificationType.TRANSACTION_INDICATOR_SIGN,
      ];
      for (const t of types) {
        const res = await (service as any).getNotificationReceiverIds(
          em as any,
          {} as any,
          t,
          [] as any,
        );
        expect(res).toEqual([6, 7]);
      }
    });

    it('returns creator + approvers + observers + required for execution/expired/archived etc.', async () => {
      const types = [
        NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
        NotificationType.TRANSACTION_EXECUTED,
        NotificationType.TRANSACTION_INDICATOR_EXECUTED,
        NotificationType.TRANSACTION_INDICATOR_FAILED,
        NotificationType.TRANSACTION_EXPIRED,
        NotificationType.TRANSACTION_INDICATOR_EXPIRED,
        NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
      ];
      const expected = [1, 2, 3, 5, 6, 7];
      for (const t of types) {
        const res = await (service as any).getNotificationReceiverIds(
          em as any,
          {} as any,
          t,
          [] as any,
        );
        expect(res).toEqual(expected);
      }
    });

    it('returns approvers + observers + required for CANCELLED / INDICATOR_CANCELLED', async () => {
      const res = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_CANCELLED,
        [] as any,
      );
      expect(res).toEqual([2, 3, 5, 6, 7]);

      const res2 = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        NotificationType.TRANSACTION_INDICATOR_CANCELLED,
        [] as any,
      );
      expect(res2).toEqual([2, 3, 5, 6, 7]);
    });

    it('logs a warning and returns empty array for unknown types', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await (service as any).getNotificationReceiverIds(
        em as any,
        {} as any,
        999 as any,
        [] as any,
      );
      expect(res).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No recipient logic for'));
      warnSpy.mockRestore();
    });
  });

  describe('filterReceiversByPreferenceForType', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('filterReceiversByPreferenceForType loads cache and filters', async () => {
      em.find.mockResolvedValue([
        { id: 1, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, inApp: false }] },
        { id: 2, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, inApp: true }] },
      ]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([1, 2]),
        cache,
      );

      expect(res).toEqual([2]);

      // second call uses cache (no DB call)
      em.find.mockClear();
      const res2 = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([1, 2]),
        cache,
      );
      expect(em.find).not.toHaveBeenCalled();
      expect(res2).toEqual([2]);
    });

    it('filterReceiversByPreferenceForType continues when user not found after load', async () => {
      // em.find returns no users -> cache stays empty -> user is undefined -> continue branch
      em.find.mockResolvedValueOnce([]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([3]),
        cache,
      );

      expect(res).toEqual([]);
    });

    it('filterReceiversByPreferenceForType treats missing preferences as allowed (default true)', async () => {
      // user returned without notificationPreferences -> preference is undefined -> default true
      em.find.mockResolvedValueOnce([{ id: 4 }]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([4]),
        cache,
      );

      expect(res).toEqual([4]);
    });
  });

  it('createNotificationReceivers returns saved receivers or empty when none', async () => {
    const notification = { id: 5, type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES } as any;
    em.save.mockResolvedValueOnce([{ id: 500 }]);
    const empty = await (service as any).createNotificationReceivers(em as any, notification, []);
    expect(empty).toEqual([]);

    const res = await (service as any).createNotificationReceivers(em as any, notification, [1, 2]);
    expect(em.save).toHaveBeenCalled();
    expect(res[0].id).toBe(500);
  });

  it('deleteExistingIndicators deletes and returns mapping', async () => {
    const nr = [{ id: 10, userId: 1 }];
    em.find.mockResolvedValueOnce([
      { id: 100, notificationReceivers: nr },
    ]);

    em.delete.mockResolvedValue({ raw: [], affected: 1 });

    const result = await (service as any).deleteExistingIndicators(em as any, { id: 5 } as any);
    expect(em.delete).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ userId: 1, receiverId: 10 }]);
  });

  it('processNotificationType creates new and updates existing receivers', async () => {
    const notification = {
      id: 200,
      notificationReceivers: [{ id: 700, userId: 1 }],
      type: NotificationType.TRANSACTION_EXECUTED,
    } as any;

    em.findOne.mockResolvedValueOnce(notification);
    em.save.mockResolvedValueOnce([{ id: 800, userId: 2 }]); // new created
    em.update.mockResolvedValueOnce({ raw: [], affected: 1 });
    em.find.mockResolvedValueOnce([{ id: 700, userId: 1, notification } as any]); // reloaded updated receivers

    const cache = new Map<number, User>();
    cache.set(1 as any, { id: 1 } as any);
    cache.set(2 as any, { id: 2 } as any);

    jest
      .spyOn(service as any, 'filterReceiversByPreferenceForType')
      .mockResolvedValue([1, 2]);

    const { newReceivers, updatedReceivers } = await (service as any).processNotificationType(
      em as any,
      55,
      NotificationType.TRANSACTION_EXECUTED,
      new Set([1, 2]),
      cache,
    );

    expect(newReceivers.length).toBe(1);
    expect(updatedReceivers.length).toBe(1);
    expect(em.update).toHaveBeenCalled();
  });

  it('processNotificationType uses in-app update fields when channel.email is falsey', async () => {
    const notificationType = NotificationType.TRANSACTION_INDICATOR_SIGN;

    // Stub existing notification with two receivers
    const notification = { id: 123, notificationReceivers: [{ id: 10, userId: 1 }, { id: 11, userId: 2 }] } as any;
    em.findOne.mockResolvedValueOnce(notification);

    // Ensure all users pass preference filter
    jest.spyOn(service as any, 'filterReceiversByPreferenceForType').mockResolvedValue([1, 2]);

    // Temporarily override NOTIFICATION_CHANNELS for this type to have email = false
    const originalChannel = NOTIFICATION_CHANNELS[notificationType];
    NOTIFICATION_CHANNELS[notificationType] = { email: false, inApp: true };

    // Mock DB update/find/save flows used by the method
    em.update.mockResolvedValueOnce({});
    em.find.mockResolvedValueOnce([{ id: 10, userId: 1, notification } as any, { id: 11, userId: 2, notification } as any]);
    em.save.mockResolvedValueOnce([]); // createNotificationReceivers -> none

    const cache = new Map<number, User>();
    cache.set(1, { id: 1 } as any);
    cache.set(2, { id: 2 } as any);

    const result = await (service as any).processNotificationType(
      em as any,
      /* transactionId */ 999,
      notificationType,
      new Set([1, 2]),
      cache,
    );

    // verify update used in-app fields (email false => in-app update)
    expect(em.update).toHaveBeenCalled();
    const updateArgs = em.update.mock.calls[0];
    expect(updateArgs[2]).toEqual({ isRead: false, isInAppNotified: false });

    // cleanup: restore original channels mapping
    NOTIFICATION_CHANNELS[notificationType] = originalChannel;
  });

  it('processReminderEmail creates a new notification and receivers', async () => {
    const tx: any = { id: 1, validStart: 1, transactionId: 'tx1', mirrorNetwork: 'net' };
    em.save.mockResolvedValueOnce({ id: 900 }); // notification
    (service as any).filterReceiversByPreferenceForType = jest.fn().mockResolvedValue([10]);
    (service as any).createNotificationReceivers = jest.fn().mockResolvedValue([{ id: 901 }]);

    const res = await (service as any).processReminderEmail(em as any, tx, new Set([10]), new Map());
    expect(em.save).toHaveBeenCalled();
    expect(res[0].id).toBe(901);
  });

  describe('collectEmailNotifications', () => {
    beforeEach(() => jest.clearAllMocks());

    it('collects notifications when user has an email', () => {
      const cache = new Map<number, any>();
      cache.set(2, { id: 2, email: 'ok@example.com' });

      const newReceivers = [
        { id: 12, userId: 2, notification: { id: 102 } },
      ] as any[];
      const updatedReceivers: any[] = [];

      const emailNotifications: { [email: string]: any[] } = {};
      const receiverIds: number[] = [];

      (service as any).collectEmailNotifications(newReceivers, updatedReceivers, emailNotifications, receiverIds, cache);

      expect(Object.keys(emailNotifications)).toEqual(['ok@example.com']);
      expect(emailNotifications['ok@example.com'][0].id).toBe(102);
      expect(receiverIds).toContain(12);
    });

    it('logs and skips receivers when user missing or has no email', () => {
      const cache = new Map<number, any>();
      cache.set(1, { id: 1, email: null }); // present but no email
      // user 3 is not set in cache -> should also be logged/skipped

      const newReceivers = [
        { id: 11, userId: 1, notification: { id: 101 } },
      ] as any[];
      const updatedReceivers = [
        { id: 13, userId: 3, notification: { id: 103 } },
      ] as any[];

      const emailNotifications: { [email: string]: any[] } = {};
      const receiverIds: number[] = [];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (service as any).collectEmailNotifications(newReceivers, updatedReceivers, emailNotifications, receiverIds, cache);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User 1 not found in cache or missing email'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User 3 not found in cache or missing email'));
      expect(Object.keys(emailNotifications)).toEqual([]);
      expect(receiverIds).toEqual([]);

      consoleSpy.mockRestore();
    });
  });


  it('sendDeletionNotifications emits delete events', async () => {
    await (service as any).sendDeletionNotifications({ 1: [100, 101] });
    expect(emitDeleteNotifications).toHaveBeenCalled();
  });

  it('sendInAppNotifications emits and marks notified', async () => {
    em.update.mockResolvedValue({});
    await (service as any).sendInAppNotifications({ 1: [{ id: 10 }, { id: 11 }] }, [10, 11]);
    expect(emitNewNotifications).toHaveBeenCalled();
    expect(em.update).toHaveBeenCalledWith(
      NotificationReceiver,
      { id: In([10, 11]) },
      { isInAppNotified: true },
    );
  });

  describe('sendEmailNotifications', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls onSuccess and updates receivers when emit succeeds', async () => {
      em.update.mockResolvedValue({});
      (emitEmailNotifications as jest.Mock).mockImplementation(async (_pub, _dtos, onSuccess, _onError) => {
        await onSuccess();
      });

      await (service as any).sendEmailNotifications(
        { 'test@example.com': [{ id: 1 } as any] },
        [99],
      );

      expect(em.update).toHaveBeenCalledWith(
        NotificationReceiver,
        { id: In([99]) },
        { isEmailSent: true },
      );
    });

    it('calls onError and logs when emit fails (no DB update)', async () => {
      em.update.mockResolvedValue({});
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (emitEmailNotifications as jest.Mock).mockImplementation(async (_pub, _dtos, _onSuccess, onError) => {
        await onError(new Error('send-failed'));
      });

      await (service as any).sendEmailNotifications(
        { 'no-reply@example.com': [{ id: 10 } as any] },
        [10],
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send email notifications:'), expect.any(Error));
      expect(em.update).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('buildAdditionData', () => {
    it('buildAdditionalData includes groupId when present', () => {
      const transaction: any = {
        transactionId: 'tx-1',
        mirrorNetwork: 'net-1',
        groupItem: { groupId: 'group-123' },
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-1',
        network: 'net-1',
        groupId: 'group-123',
      });
    });

    it('buildAdditionalData omits groupId when missing', () => {
      const transaction: any = {
        transactionId: 'tx-2',
        mirrorNetwork: 'net-2',
        groupItem: {}, // or `groupItem: undefined`
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-2',
        network: 'net-2',
      });
      expect(res).not.toHaveProperty('groupId');
    });
  });

  describe('handleTransactionStatusUpdateNotifications', () => {
    beforeEach(() => jest.clearAllMocks());

    it('processes deletions, creates in-app receivers and collects email receivers', async () => {
      const deletionNotifications: { [userId: number]: number[] } = {};
      const inAppNotifications: { [userId: number]: any[] } = {};
      const inAppReceiverIds: number[] = [];
      const emailNotifications: { [email: string]: any[] } = {};
      const emailReceiverIds: number[] = [];
      const affectedUserIds = new Set<number>();

      const transaction = { id: 42, transactionId: 'tx-42', mirrorNetwork: 'net' } as any;
      const approvers: any[] = [];

      // deleteExistingIndicators returns one deleted receiver
      jest.spyOn(service as any, 'deleteExistingIndicators').mockResolvedValue([
        { userId: 1, receiverId: 10 },
      ]);

      // createNotificationWithReceivers: first call for sync (in-app), second call for email
      const createdInApp = [{ id: 101, userId: 2 } as any];
      const createdEmail = [{ id: 102, userId: 3, notification: { id: 201 } } as any];

      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers')
        .mockImplementationOnce(async () => createdInApp)
        .mockImplementationOnce(async () => createdEmail);

      const collectEmailSpy = jest.spyOn(service as any, 'collectEmailNotifications').mockImplementation(() => {});

      await (service as any).handleTransactionStatusUpdateNotifications(
        em as any,
        transaction,
        approvers,
        NotificationType.TRANSACTION_INDICATOR_EXECUTED, // syncType present
        NotificationType.TRANSACTION_EXECUTED, // emailType present
        new Map(),
        new Map(),
        deletionNotifications,
        inAppNotifications,
        inAppReceiverIds,
        emailNotifications,
        emailReceiverIds,
        affectedUserIds,
        123,
      );

      // deletedReceiverIds.forEach updated deletionNotifications and affectedUserIds
      expect((service as any).deleteExistingIndicators).toHaveBeenCalledWith(em as any, transaction);
      expect(deletionNotifications[1]).toEqual([10]);
      expect(affectedUserIds.has(1)).toBe(true);

      // new in-app receivers were added to inAppNotifications and inAppReceiverIds
      expect(inAppNotifications[2]).toBeDefined();
      expect(inAppNotifications[2].length).toBeGreaterThan(0);
      expect(inAppReceiverIds).toContain(101);

      // createNotificationWithReceivers called twice (sync + email) and collectEmailNotifications invoked for email receivers
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(collectEmailSpy).toHaveBeenCalledWith(createdEmail, [], emailNotifications, emailReceiverIds, expect.any(Map));
    });

    it('logs an error when internal call throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(service as any, 'deleteExistingIndicators').mockRejectedValue(new Error('boom'));

      await (service as any).handleTransactionStatusUpdateNotifications(
        em as any,
        { transactionId: 'tx', mirrorNetwork: 'n' } as any,
        [],
        NotificationType.TRANSACTION_INDICATOR_EXECUTED,
        null,
        new Map(),
        new Map(),
        {},
        {},
        [],
        {},
        [],
        new Set(),
        123,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing notifications for transaction 123:'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleUserRegisteredNotifications', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns early when no admin recipients (allReceiverIds.size === 0)', async () => {
      // make both preference calls return empty arrays -> early return
      jest
        .spyOn(service as any, 'filterReceiversByPreferenceForType')
        .mockResolvedValueOnce([]) // in-app
        .mockResolvedValueOnce([]); // email

      // ensure save is not called
      if ((em as any).save) (em as any).save.mockClear?.();

      const inAppNotifications: { [userId: number]: NotificationReceiver[] } = {};
      const emailNotifications: { [email: string]: Notification[] } = {};
      const inAppReceiverIds: number[] = [];
      const emailReceiverIds: number[] = [];

      await (service as any).handleUserRegisteredNotifications(
        em as any,
        77, // userId
        new Set([2, 3]),
        { foo: 'bar' },
        new Map(),
        inAppNotifications,
        emailNotifications,
        inAppReceiverIds,
        emailReceiverIds,
      );

      expect((em as any).save).not.toHaveBeenCalled();
      expect(Object.keys(inAppNotifications).length).toBe(0);
      expect(Object.keys(emailNotifications).length).toBe(0);
      expect(inAppReceiverIds).toEqual([]);
      expect(emailReceiverIds).toEqual([]);
    });

    it('creates notification and receivers and collects in-app + email notifications', async () => {
      // in-app recipients: [2], email recipients: [3]
      jest
        .spyOn(service as any, 'filterReceiversByPreferenceForType')
        .mockResolvedValueOnce([2]) // in-app
        .mockResolvedValueOnce([3]); // email

      // mock saved notification and receivers
      const savedNotification = { id: 200, type: NotificationType.USER_REGISTERED } as any;
      const savedReceivers = [
        { id: 10, userId: 2, notification: savedNotification } as any,
        { id: 11, userId: 3, notification: savedNotification } as any,
      ];

      const saveMock = jest.spyOn(em as any, 'save')
        .mockImplementationOnce(async () => savedNotification) // Notification.save
        .mockImplementationOnce(async () => savedReceivers); // NotificationReceiver.save

      const cache = new Map<number, any>();
      // provide email for user 3 so collectEmailNotifications will include it
      cache.set(3, { id: 3, email: 'user3@example.com' });

      const inAppNotifications: { [userId: number]: NotificationReceiver[] } = {};
      const emailNotifications: { [email: string]: Notification[] } = {};
      const inAppReceiverIds: number[] = [];
      const emailReceiverIds: number[] = [];

      await (service as any).handleUserRegisteredNotifications(
        em as any,
        77,
        new Set([2, 3]),
        { some: 'data' },
        cache,
        inAppNotifications,
        emailNotifications,
        inAppReceiverIds,
        emailReceiverIds,
      );

      // Save called for notification and receivers
      expect(saveMock).toHaveBeenCalledTimes(2);

      // In-app: user 2 should be present
      expect(inAppNotifications[2]).toBeDefined();
      expect(inAppNotifications[2].length).toBeGreaterThan(0);
      expect(inAppReceiverIds).toContain(10);

      // Email: there should be an entry for user3's email and it should contain the notification
      expect(emailNotifications['user3@example.com']).toBeDefined();
      expect(emailNotifications['user3@example.com'][0].id).toBe(savedNotification.id);
      expect(emailReceiverIds).toContain(11);
    });
  });

  describe('prepareEventContext', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns null for empty events', async () => {
      const res = await (service as any).prepareEventContext([], false);
      expect(res).toBeNull();
    });

    it('returns populated context for non-empty events', async () => {
      const events = [{ entityId: 1 } as any];

      // stub internal helpers to avoid DB work
      const txMap = new Map<number, any>();
      txMap.set(1, { id: 1 } as any);
      jest.spyOn(service as any, 'fetchTransactionsWithRelations').mockResolvedValueOnce(txMap);
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValueOnce(new Map());

      const ctx = await (service as any).prepareEventContext(events, false);

      expect(ctx).not.toBeNull();
      expect(ctx!.transactionIds).toEqual([1]);
      expect(ctx!.transactionMap).toBe(txMap);
      expect(ctx!.approversMap).toEqual(new Map());
      expect(ctx!.cache).toBeInstanceOf(Map);
      expect(ctx!.keyCache).toBeInstanceOf(Map);
      expect(ctx!.inAppReceiverIds).toEqual([]);
      expect(ctx!.emailReceiverIds).toEqual([]);
      expect(ctx!.affectedUserIds).toBeInstanceOf(Set);
    });
  });

  describe('processTransactionStatusUpdateNotifications - soft-deleted transaction handling', () => {
    let transaction: any;

    beforeEach(() => {
      jest.clearAllMocks();

      transaction = {
        id: 42,
        transactionId: 'tx-42',
        mirrorNetwork: 'mirror',
        creatorKey: { userId: 11 },
        signers: [],
        observers: [],
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        deletedAt: null,
      };

      // Common: fetchTransactionsWithRelations -> first em.find call returns the transaction
      em.find.mockResolvedValueOnce([transaction]);

      // Common: approvers query
      em.query.mockResolvedValue([]);

      // Common: ensure keysRequiredToSign returns an array
      (keysRequiredToSign as jest.Mock).mockResolvedValue([]);

      // Common default implementation used by createNotificationWithReceivers
      jest.spyOn(service as any, 'filterReceiversByPreferenceForType').mockImplementation(
        async (
          _entityManager: any,
          _notificationType: NotificationType,
          userIds: Set<number>,
          cache: Map<number, User>,
        ) => {
          for (const id of Array.from(userIds)) {
            cache.set(id, {
              id,
              email: `user${id}@example.com`,
              notificationPreferences: [
                { type: NotificationType.TRANSACTION_INDICATOR_EXECUTABLE, inApp: true, email: false },
                { type: NotificationType.TRANSACTION_READY_FOR_EXECUTION, inApp: false, email: true },
              ],
            } as any);
          }
          return Array.from(userIds);
        },
      );

      // Common: make emitEmailNotifications call onSuccess so sendEmailNotifications updates flags
      (emitEmailNotifications as jest.Mock).mockImplementation(async (_pub, _dtos, onSuccess, _onError) => {
        await onSuccess();
      });
    });

    it('processTransactionStatusUpdateNotifications returns early when prepareEventContext is null', async () => {
      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(null);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 1 } as any]);

      expect(prepSpy).toHaveBeenCalledWith([{ entityId: 1 } as any], true);
      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
      expect(emitNotifyClients).not.toHaveBeenCalled();

      prepSpy.mockRestore();
    });

    it('processes deletions, creates in-app receivers and collects email receivers', async () => {
      // test-specific: deleteExistingIndicators will call em.find again to look up existing notifications.
      em.find.mockResolvedValueOnce([]);

      // test-specific: For in-app/email notification creation and receivers (saves inside transaction)
      em.save
        .mockResolvedValueOnce({ id: 300, type: NotificationType.TRANSACTION_INDICATOR_EXECUTABLE }) // save Notification for in-app
        .mockResolvedValueOnce([{ id: 301, userId: 11, notification: { id: 300 } }]) // receivers for in-app
        .mockResolvedValueOnce({ id: 400, type: NotificationType.TRANSACTION_READY_FOR_EXECUTION }) // save Notification for email
        .mockResolvedValueOnce([{ id: 401, userId: 11, notification: { id: 400 } }]); // receivers for email

      await service.processTransactionStatusUpdateNotifications([{ entityId: 42 } as any]);

      expect(emitNewNotifications).toHaveBeenCalled();
      expect(emitEmailNotifications).toHaveBeenCalled();
      expect(emitNotifyClients).toHaveBeenCalled();
    });

    it('logs and normalizes soft-deleted transaction status to CANCELED before processing', async () => {
      // make this transaction soft-deleted for this test
      transaction.deletedAt = new Date();

      // spy console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // stub heavy handler so we only assert normalization and types passed in
      const handlerSpy = jest
        .spyOn(service as any, 'handleTransactionStatusUpdateNotifications')
        .mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 42 } as any]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Soft-deleted transaction 42 has unexpected status:')
      );
      expect(handlerSpy).toHaveBeenCalled();

      const callArgs = handlerSpy.mock.calls[0] as any[];
      const passedTransaction = callArgs[1] as Transaction;
      const passedSyncType = callArgs[3] as NotificationType | null;
      const passedEmailType = callArgs[4] as NotificationType | null;

      expect(passedTransaction.status).toBe(TransactionStatus.CANCELED);
      expect(passedSyncType).toBe(NotificationType.TRANSACTION_INDICATOR_CANCELLED);
      expect(passedEmailType).toBe(NotificationType.TRANSACTION_CANCELLED);

      consoleSpy.mockRestore();
      handlerSpy.mockRestore();
    });
  });

  describe('processTransactionUpdateNotifications', () => {
    beforeEach(() => jest.clearAllMocks());

    it('processTransactionUpdateNotifications returns early when prepareEventContext is null', async () => {
      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(null);

      await service.processTransactionUpdateNotifications([{ entityId: 1 } as any]);

      expect(prepSpy).toHaveBeenCalledWith([{ entityId: 1 } as any]);
      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
      expect(emitNotifyClients).not.toHaveBeenCalled();

      prepSpy.mockRestore();
    });

    it('processTransactionUpdateNotifications notifies affected users when sync type present', async () => {
      const transaction: any = {
        id: 7,
        creatorKey: { userId: 1 },
        signers: [],
        observers: [],
        status: TransactionStatus.EXECUTED,
      };

      em.find.mockResolvedValueOnce([transaction]);
      em.query.mockResolvedValueOnce([]);
      (service as any).getNotificationReceiverIds = jest.fn().mockResolvedValue([2]);

      await service.processTransactionUpdateNotifications([{ entityId: 7 } as any]);

      expect(emitNotifyClients).toHaveBeenCalled();
    });
  });

  describe('RemindSigners and RemindSignersManual', () => {
    beforeEach(() => jest.clearAllMocks());

    it('remindSigners delegates to processSignerReminders with isManual = false and returns result', async () => {
      const events = [{ entityId: 8 } as any];
      const expected = { result: 'auto' };
      const spy = jest
        .spyOn(service as any, 'processSignerReminders')
        .mockResolvedValue(expected);

      const res = await service.remindSigners(events);

      expect(spy).toHaveBeenCalledWith(events, false);
      expect(res).toBe(expected);

      spy.mockRestore();
    });

    it('remindSignersManual delegates to processSignerReminders with isManual = true and returns result', async () => {
      const events = [{ entityId: 9 } as any];
      const expected = { result: 'manual' };
      const spy = jest
        .spyOn(service as any, 'processSignerReminders')
        .mockResolvedValue(expected);

      const res = await service.remindSignersManual(events);

      expect(spy).toHaveBeenCalledWith(events, true);
      expect(res).toBe(expected);

      spy.mockRestore();
    });

    it('processSignerReminders returns early when prepareEventContext is null', async () => {
      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(null);

      await (service as any).processSignerReminders([{ entityId: 1 } as any]);

      expect(prepSpy).toHaveBeenCalledWith([{ entityId: 1 } as any]);
      expect(emitNewNotifications).not.toHaveBeenCalled();
      expect(emitEmailNotifications).not.toHaveBeenCalled();
      expect(emitNotifyClients).not.toHaveBeenCalled();

      prepSpy.mockRestore();
    });

    it('processSignerReminders handles automatic and manual flows', async () => {
      const transaction: any = {
        id: 8,
        creatorKey: { userId: 1 },
        signers: [],
        observers: [],
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        validStart: 0,
        transactionId: 'tx8',
        mirrorNetwork: 'mirror',
      };

      // fetchTransactionsWithRelations -> returns the transaction
      em.find.mockResolvedValue([transaction]);

      // getApproversByTransactionIds/internal approver lookup uses em.query:
      // return an empty array so the code receives [] (iterable) instead of undefined
      em.query.mockResolvedValue([]);

      // keysRequiredToSign for processSignerReminders
      (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 10, user: { id: 10 } }]);
      // For manual path: processNotificationType invoked; mock to return empty arrays
      (service as any).processNotificationType = jest.fn().mockResolvedValue({ newReceivers: [], updatedReceivers: [] });
      // For automatic path: processReminderEmail invoked; mock to return []
      (service as any).processReminderEmail = jest.fn().mockResolvedValue([]);

      // automatic
      await (service as any).processSignerReminders([{ entityId: 8 } as any], false);
      // manual
      await (service as any).processSignerReminders([{ entityId: 8 } as any], true);

      expect((service as any).processReminderEmail).toHaveBeenCalled();
      expect((service as any).processNotificationType).toHaveBeenCalled();
    });

    it('processSignerReminders manual path processes updated receivers from processNotificationType', async () => {
      const transaction: any = {
        id: 8,
        creatorKey: { userId: 1 },
        signers: [],
        observers: [],
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        validStart: 0,
        transactionId: 'tx8',
        mirrorNetwork: 'mirror',
      };

      // fetchTransactionsWithRelations -> returns the transaction
      em.find.mockResolvedValue([transaction]);

      // approvers query returns empty array
      em.query.mockResolvedValue([]);

      // keysRequiredToSign returns a signer id
      (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 10, user: { id: 10 } }]);

      // Prepare an updated receiver to be returned by processNotificationType
      const updatedReceiver = { id: 700, userId: 10, notification: { id: 201 } } as any;

      // For manual path: processNotificationType returns the updated receiver
      (service as any).processNotificationType = jest.fn()
        .mockResolvedValueOnce({
          newReceivers: [],
          updatedReceivers: [updatedReceiver],
        })
        .mockResolvedValueOnce({
          newReceivers: [],
          updatedReceivers: [],
        });

      // For automatic path ensure reminder email won't interfere
      (service as any).processReminderEmail = jest.fn().mockResolvedValue([]);

      // Spy on collectInAppNotifications to verify it receives the updated receiver
      const collectSpy = jest.spyOn(service as any, 'collectInAppNotifications').mockImplementation(() => {});

      // Invoke manual flow
      await (service as any).processSignerReminders([{ entityId: 8 } as any], true);

      expect((service as any).processNotificationType).toHaveBeenCalled();
      expect(collectSpy).toHaveBeenCalledWith(
        expect.any(Array), // newReceivers
        expect.arrayContaining([expect.objectContaining({ id: 700, userId: 10 })]), // updatedReceivers contains our receiver
        expect.any(Object), // inAppNotifications
        expect.any(Array), // inAppReceiverIds
      );

      collectSpy.mockRestore();
    });

    it('processSignerReminders skips when no signer keys are required (userIds.size === 0)', async () => {
      const transaction: any = { id: 8 };
      const ctx = {
        cache: new Map<number, any>(),
        keyCache: new Map<number, any>(),
        transactionMap: new Map([[8, transaction]]),
        deletionNotifications: {},
        inAppNotifications: {},
        emailNotifications: {},
        inAppReceiverIds: [],
        emailReceiverIds: [],
      };

      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      (keysRequiredToSign as jest.Mock).mockResolvedValue([]); // no keys -> userIds.size === 0

      const reminderSpy = jest.spyOn(service as any, 'processReminderEmail').mockResolvedValue([]);
      const notifyTypeSpy = jest.spyOn(service as any, 'processNotificationType').mockResolvedValue({ newReceivers: [], updatedReceivers: [] });

      await (service as any).processSignerReminders([{ entityId: 8 } as any], false);

      expect(prepSpy).toHaveBeenCalled();
      expect(keysRequiredToSign).toHaveBeenCalled();
      expect(reminderSpy).not.toHaveBeenCalled();
      expect(notifyTypeSpy).not.toHaveBeenCalled();

      prepSpy.mockRestore();
    });
  });

  describe('processUserRegisteredNotifications', () => {
    beforeEach(() => jest.clearAllMocks());

    it('handles missing user and admin notification flow', async () => {
      const evt: any = { entityId: 99, additionalData: { foo: 'bar' } };

      // missing user
      em.findOne.mockResolvedValueOnce(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await service.processUserRegisteredNotifications(evt);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // admins present and preferences vary
      const admin1 = { id: 1, admin: true, notificationPreferences: [{ type: NotificationType.USER_REGISTERED, inApp: true }], email: 'a@example.com' } as any;
      const admin2 = { id: 2, admin: true, notificationPreferences: [{ type: NotificationType.USER_REGISTERED, inApp: false }], email: 'b@example.com' } as any;

      em.findOne.mockResolvedValueOnce({ id: 99 }); // registered user
      em.find.mockResolvedValueOnce([admin1, admin2]); // admin users

      em.save
        .mockResolvedValueOnce({ id: 500 }) // notification
        .mockResolvedValueOnce([
          { id: 501, userId: 1, notification: { id: 500 } },
          { id: 502, userId: 2, notification: { id: 500 } },
        ]); // receivers

      // filterReceiversByPreferenceForType returns in-app then email
      jest.spyOn(service as any, 'filterReceiversByPreferenceForType')
        .mockResolvedValueOnce([1]) // in-app
        .mockResolvedValueOnce([2]); // email

      (emitEmailNotifications as jest.Mock).mockImplementation(async (_pub, _dtos, onSuccess, _onError) => {
        await onSuccess();
      });

      await service.processUserRegisteredNotifications(evt);

      expect(emitNewNotifications).toHaveBeenCalled();
      expect(emitEmailNotifications).toHaveBeenCalled();
    });

    it('returns early when no admin recipients (allReceiverIds.size === 0)', async () => {
      const evt: any = { entityId: 100, additionalData: {} };

      // registered user exists
      em.findOne.mockResolvedValueOnce({ id: 100 });

      // no admin users returned
      em.find.mockResolvedValueOnce([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await service.processUserRegisteredNotifications(evt);

      expect(consoleSpy).toHaveBeenCalledWith('No admin users found to notify');

      consoleSpy.mockRestore();
    });
  });
});
