import { Test } from '@nestjs/testing';
import { ReceiverService } from './receiver.service';
import { EntityManager, In } from 'typeorm';

import { DismissedNotificationReceiverDto, TransactionSignatureService } from '@app/common';
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

  it('getTransactionParticipants omits creatorId and does not include it in participants when creatorKey is null', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 100, user: { id: 100 } }]);

    const tx: any = {
      creatorKey: null,
      signers: [{ userId: 2 }],
      observers: [{ userId: 3 }],
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
    };

    const approvers = [
      { userId: 4, approved: null } as TransactionApprover,
      { userId: 5, approved: true } as TransactionApprover,
    ];

    const result = await (service as any).getTransactionParticipants(em as any, tx, approvers, new Map());

    expect('creatorId' in result).toBe(false);
    expect(result.participants).toEqual(expect.arrayContaining([2, 3, 4, 5, 100]));
    expect(result.participants).not.toContain(null);
    expect(result.participants).not.toContain(undefined);
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

    it('excludes user with email:false for an email-only notification type and uses cache on second call', async () => {
      // TRANSACTION_EXECUTED is email-only (email:true, inApp:false)
      em.find.mockResolvedValue([
        { id: 1, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, email: false, inApp: true }] },
        { id: 2, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, email: true, inApp: false }] },
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

    it('excludes user with email:false for TRANSACTION_READY_FOR_EXECUTION', async () => {
      // Regression test for the original bug: email:false was ignored because code checked inApp
      em.find.mockResolvedValueOnce([
        { id: 1, notificationPreferences: [{ type: NotificationType.TRANSACTION_READY_FOR_EXECUTION, email: false, inApp: true }] },
        { id: 2, notificationPreferences: [{ type: NotificationType.TRANSACTION_READY_FOR_EXECUTION, email: true, inApp: false }] },
      ]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        new Set([1, 2]),
        cache,
      );

      expect(res).toEqual([2]);
    });

    it('excludes user with inApp:false for an inApp-only notification type', async () => {
      // USER_REGISTERED is inApp-only (email:false, inApp:true)
      em.find.mockResolvedValueOnce([
        { id: 1, notificationPreferences: [{ type: NotificationType.USER_REGISTERED, email: true, inApp: false }] },
        { id: 2, notificationPreferences: [{ type: NotificationType.USER_REGISTERED, email: false, inApp: true }] },
      ]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.USER_REGISTERED,
        new Set([1, 2]),
        cache,
      );

      expect(res).toEqual([2]);
    });

    it('includes user with inApp:false when notification type is email-only', async () => {
      // inApp preference is irrelevant for email-only notifications
      em.find.mockResolvedValueOnce([
        { id: 1, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, email: true, inApp: false }] },
      ]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([1]),
        cache,
      );

      expect(res).toEqual([1]);
    });

    it('continues when user not found after load', async () => {
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

    it('treats missing preference record as allowed (default true)', async () => {
      // user has no preference for this type -> allowed by default
      em.find.mockResolvedValueOnce([{ id: 4, notificationPreferences: [] }]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([4]),
        cache,
      );

      expect(res).toEqual([4]);
    });

    it('treats missing notificationPreferences relation as allowed (default true)', async () => {
      // user returned without notificationPreferences relation
      em.find.mockResolvedValueOnce([{ id: 5 }]);

      const cache = new Map<number, User>();
      const res = await (service as any).filterReceiversByPreferenceForType(
        em as any,
        NotificationType.TRANSACTION_EXECUTED,
        new Set([5]),
        cache,
      );

      expect(res).toEqual([5]);
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

    await (service as any).processNotificationType(
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

    it('buildAdditionalData includes isManual and validStart when isManual is true', () => {
      const validStart = new Date('2025-01-01T00:00:00.000Z');
      const transaction: any = {
        transactionId: 'tx-3',
        mirrorNetwork: 'net-3',
        isManual: true,
        validStart,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-3',
        network: 'net-3',
        isManual: true,
        validStart,
      });
    });

    it('buildAdditionalData omits isManual and validStart when isManual is falsey', () => {
      const transaction: any = {
        transactionId: 'tx-4',
        mirrorNetwork: 'net-4',
        isManual: false,
        validStart: new Date('2025-01-01T00:00:00.000Z'),
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-4',
        network: 'net-4',
      });
      expect(res).not.toHaveProperty('isManual');
      expect(res).not.toHaveProperty('validStart');
    });

    it('buildAdditionalData includes statusCode when it is a number', () => {
      const transaction: any = {
        transactionId: 'tx-5',
        mirrorNetwork: 'net-5',
        statusCode: 22,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-5',
        network: 'net-5',
        statusCode: 22,
      });
    });

    it('buildAdditionalData includes statusCode when it is 0', () => {
      const transaction: any = {
        transactionId: 'tx-6',
        mirrorNetwork: 'net-6',
        statusCode: 0,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-6',
        network: 'net-6',
        statusCode: 0,
      });
    });

    it('buildAdditionalData omits statusCode when it is null', () => {
      const transaction: any = {
        transactionId: 'tx-7',
        mirrorNetwork: 'net-7',
        statusCode: null,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-7',
        network: 'net-7',
      });
      expect(res).not.toHaveProperty('statusCode');
    });

    it('buildAdditionalData omits statusCode when it is undefined', () => {
      const transaction: any = {
        transactionId: 'tx-8',
        mirrorNetwork: 'net-8',
        statusCode: undefined,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-8',
        network: 'net-8',
      });
      expect(res).not.toHaveProperty('statusCode');
    });

    it('buildAdditionalData composes groupId + isManual + statusCode together', () => {
      const validStart = new Date('2025-02-02T00:00:00.000Z');
      const transaction: any = {
        transactionId: 'tx-9',
        mirrorNetwork: 'net-9',
        groupItem: { groupId: 999 },
        isManual: true,
        validStart,
        statusCode: 104,
      };

      const res = (service as any).buildAdditionalData(transaction);

      expect(res).toEqual({
        transactionId: 'tx-9',
        network: 'net-9',
        groupId: 999,
        isManual: true,
        validStart,
        statusCode: 104,
      });
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
      const affectedUsers = new Map<number, { transactionIds: Set<number>; groupIds: Set<number> }>();

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
        affectedUsers,
        123,
      );

      // deletedReceiverIds.forEach updated deletionNotifications and affectedUsers
      expect((service as any).deleteExistingIndicators).toHaveBeenCalledWith(em as any, transaction);
      expect(deletionNotifications[1]).toEqual([10]);
      expect(affectedUsers.has(1)).toBe(true);
      expect(affectedUsers.get(1)!.transactionIds.has(123)).toBe(true);

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
        new Map(),
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
      expect(ctx!.affectedUsers).toBeInstanceOf(Map);
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

    it('processTransactionStatusUpdateNotifications skips missing transaction and still sends batch notifications', async () => {
      const ctx = {
        cache: new Map<number, any>(),
        keyCache: new Map<number, any>(),
        transactionMap: new Map(), // empty — no transaction found
        approversMap: new Map(),
        deletionNotifications: {},
        inAppNotifications: {},
        emailNotifications: {},
        inAppReceiverIds: [],
        emailReceiverIds: [],
        affectedUsers: new Map(),
      };

      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const handlerSpy = jest
        .spyOn(service as any, 'handleTransactionStatusUpdateNotifications')
        .mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 999 } as any]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('999'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
      expect(handlerSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      prepSpy.mockRestore();
      handlerSpy.mockRestore();
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

    it('processSignerReminders skips missing transaction and logs warning', async () => {
      const ctx = {
        cache: new Map<number, any>(),
        keyCache: new Map<number, any>(),
        transactionMap: new Map(), // empty — no transaction found
        deletionNotifications: {},
        inAppNotifications: {},
        emailNotifications: {},
        inAppReceiverIds: [],
        emailReceiverIds: [],
      };

      const prepSpy = jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await (service as any).processSignerReminders([{ entityId: 777 } as any], false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('777'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
      expect(keysRequiredToSign).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      prepSpy.mockRestore();
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
      expect(keysRequiredToSign).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { cache: expect.any(Map), excludeAlreadySigned: true },
      );
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
      expect(keysRequiredToSign).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { cache: expect.any(Map), excludeAlreadySigned: true },
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
      expect(keysRequiredToSign).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { cache: expect.any(Map), excludeAlreadySigned: true },
      );
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

  describe('processDismissedNotifications', () => {
    it('should group notification ids by userId and call sendDeletionNotifications', async () => {
      const sendDeletionSpy = jest
        .spyOn(service as any, 'sendDeletionNotifications')
        .mockResolvedValue(undefined);

      const event: DismissedNotificationReceiverDto[] = [
        { id: 1, userId: 10 },
        { id: 2, userId: 10 },
        { id: 3, userId: 20 },
      ];

      await service.processDismissedNotifications(event);

      expect(sendDeletionSpy).toHaveBeenCalledWith({
        10: [1, 2],
        20: [3],
      });
    });

    it('should handle a single notification', async () => {
      const sendDeletionSpy = jest
        .spyOn(service as any, 'sendDeletionNotifications')
        .mockResolvedValue(undefined);

      const event: DismissedNotificationReceiverDto[] = [{ id: 5, userId: 99 }];

      await service.processDismissedNotifications(event);

      expect(sendDeletionSpy).toHaveBeenCalledWith({ 99: [5] });
    });

    it('should handle empty event array', async () => {
      const sendDeletionSpy = jest
        .spyOn(service as any, 'sendDeletionNotifications')
        .mockResolvedValue(undefined);

      await service.processDismissedNotifications([]);

      expect(sendDeletionSpy).toHaveBeenCalledWith({});
    });
  });

  describe('getEmailTier', () => {
    it('returns 1 for TRANSACTION_WAITING_FOR_SIGNATURES', () => {
      expect((service as any).getEmailTier(NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES)).toBe(1);
    });

    it('returns 2 for TRANSACTION_READY_FOR_EXECUTION', () => {
      expect((service as any).getEmailTier(NotificationType.TRANSACTION_READY_FOR_EXECUTION)).toBe(2);
    });

    it('returns 3 for TRANSACTION_EXECUTED', () => {
      expect((service as any).getEmailTier(NotificationType.TRANSACTION_EXECUTED)).toBe(3);
    });

    it('returns 3 for TRANSACTION_EXPIRED', () => {
      expect((service as any).getEmailTier(NotificationType.TRANSACTION_EXPIRED)).toBe(3);
    });

    it('returns 3 for TRANSACTION_CANCELLED', () => {
      expect((service as any).getEmailTier(NotificationType.TRANSACTION_CANCELLED)).toBe(3);
    });

    it('returns 3 for null', () => {
      expect((service as any).getEmailTier(null)).toBe(3);
    });

    it('returns 3 for an unknown/unmapped notification type', () => {
      expect((service as any).getEmailTier('SOME_UNMAPPED_TYPE' as any)).toBe(3);
    });
  });

  describe('isLastInGroupToReachStage', () => {
    const makeTx = (id: number, status: TransactionStatus): Transaction =>
      ({ id, status } as any);

    it('returns true for a single-transaction group', () => {
      const tx = makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES);
      expect(
        (service as any).isLastInGroupToReachStage(tx, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, [tx]),
      ).toBe(true);
    });

    it('returns true when all peers are at the same tier', () => {
      const txA = makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES);
      const txB = makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES);
      const all = [txA, txB];
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, all)).toBe(true);
      expect((service as any).isLastInGroupToReachStage(txB, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, all)).toBe(true);
    });

    it('returns false when any peer is at an earlier tier', () => {
      const txA = makeTx(1, TransactionStatus.WAITING_FOR_EXECUTION); // tier 2
      const txB = makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES); // tier 1 — not yet at tier 2
      const all = [txA, txB];
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_READY_FOR_EXECUTION, all)).toBe(false);
    });

    it('returns true when all peers have moved past this tier', () => {
      const txA = makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES); // tier 1
      const txB = makeTx(2, TransactionStatus.EXECUTED); // tier 3 — already past tier 1
      const all = [txA, txB];
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, all)).toBe(true);
    });

    it('skips CANCELLED peers when checking tier', () => {
      const txA = makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES);
      const cancelled = makeTx(2, TransactionStatus.CANCELED);
      const all = [txA, cancelled];
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, all)).toBe(true);
    });

    it('returns true when all other members are CANCELLED', () => {
      const txA = makeTx(3, TransactionStatus.EXECUTED);
      const c1 = makeTx(1, TransactionStatus.CANCELED);
      const c2 = makeTx(2, TransactionStatus.CANCELED);
      const all = [c1, c2, txA];
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_EXECUTED, all)).toBe(true);
    });

    it('treats EXECUTED and EXPIRED as the same tier (tier 3) — both return true', () => {
      const txA = makeTx(1, TransactionStatus.EXECUTED);
      const txB = makeTx(2, TransactionStatus.EXPIRED);
      const all = [txA, txB];
      // Both at tier 3; either can be the trigger
      expect((service as any).isLastInGroupToReachStage(txA, NotificationType.TRANSACTION_EXECUTED, all)).toBe(true);
      expect((service as any).isLastInGroupToReachStage(txB, NotificationType.TRANSACTION_EXPIRED, all)).toBe(true);
    });

    it('treats FAILED and REJECTED as tier 3', () => {
      const txExecuted = makeTx(1, TransactionStatus.EXECUTED);
      const txFailed = makeTx(2, TransactionStatus.FAILED);
      const txRejected = makeTx(3, TransactionStatus.REJECTED);
      const all = [txExecuted, txFailed, txRejected];
      // All tier 3 — any of them is eligible to trigger the group email
      expect((service as any).isLastInGroupToReachStage(txExecuted, NotificationType.TRANSACTION_EXECUTED, all)).toBe(true);
      expect((service as any).isLastInGroupToReachStage(txFailed, NotificationType.TRANSACTION_FAILED, all)).toBe(true);
      expect((service as any).isLastInGroupToReachStage(txRejected, NotificationType.TRANSACTION_REJECTED, all)).toBe(true);
    });
  });

  describe('handleGroupEmailForLastTransaction', () => {
    const makeTx = (id: number, status: TransactionStatus): Transaction => ({
      id,
      status,
      transactionId: `tx-${id}`,
      mirrorNetwork: 'testnet',
      groupItem: { groupId: 100 },
    } as any);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns immediately for empty groupTransactions without querying the DB', async () => {
      const approversSpy = jest.spyOn(service as any, 'getApproversByTransactionIds');

      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), {}, [], [],
      );

      expect(approversSpy).not.toHaveBeenCalled();
    });

    it('skips transactions whose status maps to a null emailType (e.g., ARCHIVED)', async () => {
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValue(new Map());
      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers').mockResolvedValue([]);

      const tx = makeTx(1, TransactionStatus.ARCHIVED);
      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), {}, [], [tx],
      );

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('skips CANCELLED transactions', async () => {
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValue(new Map());
      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers').mockResolvedValue([]);

      const tx = makeTx(1, TransactionStatus.CANCELED);
      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), {}, [], [tx],
      );

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('creates a notification and collects email receivers for a valid (EXECUTED) transaction', async () => {
      const fakeReceiver = { id: 99, userId: 5 } as any;
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValue(new Map());
      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers').mockResolvedValue([fakeReceiver]);
      const collectSpy = jest.spyOn(service as any, 'collectEmailNotifications').mockImplementation(() => {});

      const emailNotifications = {};
      const emailReceiverIds: number[] = [];
      const tx = makeTx(1, TransactionStatus.EXECUTED);

      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), emailNotifications, emailReceiverIds, [tx],
      );

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledWith(
        [fakeReceiver], [], emailNotifications, emailReceiverIds, expect.any(Map),
      );
    });

    it('processes email-enabled statuses and skips CANCELLED, null-mapped (ARCHIVED), and email-disabled (FAILED, REJECTED) ones', async () => {
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValue(new Map());
      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers').mockResolvedValue([]);
      jest.spyOn(service as any, 'collectEmailNotifications').mockImplementation(() => {});

      const txExecuted = makeTx(1, TransactionStatus.EXECUTED);
      const txExpired = makeTx(2, TransactionStatus.EXPIRED);
      const txFailed = makeTx(3, TransactionStatus.FAILED);     // TRANSACTION_FAILED → email: false → skipped
      const txRejected = makeTx(4, TransactionStatus.REJECTED); // TRANSACTION_REJECTED → email: false → skipped
      const txCancelled = makeTx(5, TransactionStatus.CANCELED); // skipped (individual email)
      const txArchived = makeTx(6, TransactionStatus.ARCHIVED);  // null emailType → skipped

      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), {}, [],
        [txExecuted, txExpired, txFailed, txRejected, txCancelled, txArchived],
      );

      // Only EXECUTED and EXPIRED have email: true; FAILED/REJECTED are classified but email-disabled
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('catches per-transaction errors and continues processing remaining transactions', async () => {
      jest.spyOn(service as any, 'getApproversByTransactionIds').mockResolvedValue(new Map());
      const createSpy = jest.spyOn(service as any, 'createNotificationWithReceivers')
        .mockRejectedValueOnce(new Error('db error'))
        .mockResolvedValueOnce([]);
      jest.spyOn(service as any, 'collectEmailNotifications').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const tx1 = makeTx(1, TransactionStatus.EXECUTED);
      const tx2 = makeTx(2, TransactionStatus.EXECUTED);

      await (service as any).handleGroupEmailForLastTransaction(
        em as any, new Map(), new Map(), {}, [], [tx1, tx2],
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing group email notification for transaction 1'),
        expect.any(Error),
      );
      // tx2 is still processed despite tx1's error
      expect(createSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('processTransactionStatusUpdateNotifications - group email logic', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const makeGroupTx = (
      id: number,
      status: TransactionStatus,
      groupId: number,
      opts?: { validStart?: Date; executedAt?: Date },
    ) => ({
      id,
      transactionId: `tx-${id}`,
      mirrorNetwork: 'testnet',
      status,
      groupItem: { groupId },
      deletedAt: null,
      validStart: opts?.validStart ?? new Date('2025-01-01T00:00:00Z'),
      executedAt: opts?.executedAt ?? null,
      creatorKey: null,
      signers: [],
      observers: [],
    } as any);

    it('passes normal email type for solo transactions (no groupItem)', async () => {
      const tx = { ...makeGroupTx(10, TransactionStatus.EXECUTED, 0), groupItem: null };
      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[10, tx]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      const handlerSpy = jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 10 } as any]);

      // No group pre-fetch for solo tx
      expect(em.find).not.toHaveBeenCalled();
      // emailType is forwarded as-is (not suppressed)
      expect(handlerSpy.mock.calls[0][4]).toBe(NotificationType.TRANSACTION_EXECUTED);
    });

    it('passes individual email for CANCELLED transactions even inside a group', async () => {
      const tx = makeGroupTx(20, TransactionStatus.CANCELED, 5);
      const groupTxs = [tx, makeGroupTx(21, TransactionStatus.EXECUTED, 5)];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[20, tx]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      const handlerSpy = jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      const groupHandlerSpy = jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 20 } as any]);

      // CANCELLED fires its own individual email
      expect(handlerSpy.mock.calls[0][4]).toBe(NotificationType.TRANSACTION_CANCELLED);
      expect(groupHandlerSpy).not.toHaveBeenCalled();
    });

    it('suppresses individual email (txEmailType = null) for non-CANCELLED group transactions', async () => {
      const tx = makeGroupTx(30, TransactionStatus.EXECUTED, 7);
      const otherTx = makeGroupTx(31, TransactionStatus.WAITING_FOR_SIGNATURES, 7); // different tier → not last
      const groupTxs = [tx, otherTx];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[30, tx]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      const handlerSpy = jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      const groupHandlerSpy = jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 30 } as any]);

      // Mixed tiers → isLast = false → individual email suppressed, no group email
      expect(handlerSpy.mock.calls[0][4]).toBeNull();
      expect(groupHandlerSpy).not.toHaveBeenCalled();
    });

    it('fires group email when this transaction is the last in the group to reach its tier', async () => {
      // Single-member group → the only member is always the last
      const tx = makeGroupTx(40, TransactionStatus.EXECUTED, 8);
      const groupTxs = [tx];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[40, tx]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      const groupHandlerSpy = jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 40 } as any]);

      expect(groupHandlerSpy).toHaveBeenCalledTimes(1);
      expect(groupHandlerSpy).toHaveBeenCalledWith(
        expect.anything(),       // entityManager from transaction callback
        expect.any(Map),         // cache
        expect.any(Map),         // keyCache
        ctx.emailNotifications,
        ctx.emailReceiverIds,
        groupTxs,
      );
    });

    it('does not fire group email when a peer is still at an earlier tier', async () => {
      // tx1 (EXECUTED, tier 3) has a peer still at tier 1 → not the last to reach this tier
      const tx1 = makeGroupTx(60, TransactionStatus.EXECUTED, 10);
      const tx2 = makeGroupTx(61, TransactionStatus.WAITING_FOR_SIGNATURES, 10);
      const groupTxs = [tx1, tx2];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[60, tx1]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      const groupHandlerSpy = jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 60 } as any]);

      expect(groupHandlerSpy).not.toHaveBeenCalled();
    });

    it('does not add groupId to groupsNeedingEmail for null-emailType group members (ARCHIVED)', async () => {
      // ARCHIVED maps to null emailType — should be excluded from group-tier evaluation
      const tx = makeGroupTx(70, TransactionStatus.ARCHIVED, 11);
      const groupTxs = [tx, makeGroupTx(71, TransactionStatus.EXECUTED, 11)];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[70, tx]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      const handlerSpy = jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      const groupHandlerSpy = jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 70 } as any]);

      // txEmailType should be null (no email for ARCHIVED); no group email triggered by this tx
      expect(handlerSpy.mock.calls[0][4]).toBeNull();
      expect(groupHandlerSpy).not.toHaveBeenCalled();
    });

    it('passes null txEmailType for email-channel-disabled solo types (FAILED, REJECTED)', async () => {
      const txFailed = { ...makeGroupTx(80, TransactionStatus.FAILED, 0), groupItem: null };
      const txRejected = { ...makeGroupTx(81, TransactionStatus.REJECTED, 0), groupItem: null };

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[80, txFailed], [81, txRejected]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      const handlerSpy = jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([
        { entityId: 80 } as any,
        { entityId: 81 } as any,
      ]);

      // TRANSACTION_FAILED and TRANSACTION_REJECTED have email: false — must not reach the mailer
      expect(handlerSpy.mock.calls[0][4]).toBeNull();
      expect(handlerSpy.mock.calls[1][4]).toBeNull();
    });

    it('pre-fetches group transactions exactly once per unique groupId', async () => {
      const tx1 = makeGroupTx(50, TransactionStatus.EXECUTED, 9);
      const tx2 = makeGroupTx(51, TransactionStatus.EXECUTED, 9);
      const groupTxs = [tx1, tx2];

      const ctx = {
        cache: new Map(), keyCache: new Map(),
        transactionMap: new Map([[50, tx1], [51, tx2]]),
        approversMap: new Map(),
        deletionNotifications: {}, inAppNotifications: {}, emailNotifications: {},
        inAppReceiverIds: [], emailReceiverIds: [], affectedUsers: new Map(),
      };

      jest.spyOn(service as any, 'prepareEventContext').mockResolvedValue(ctx);
      em.find.mockResolvedValueOnce(groupTxs);
      jest.spyOn(service as any, 'handleTransactionStatusUpdateNotifications').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'handleGroupEmailForLastTransaction').mockResolvedValue(undefined);

      await service.processTransactionStatusUpdateNotifications([{ entityId: 50 } as any, { entityId: 51 } as any]);

      // Two transactions share the same groupId → single IN query, not two separate finds
      expect(em.find).toHaveBeenCalledTimes(1);
      expect(em.find).toHaveBeenCalledWith(Transaction, expect.objectContaining({
        where: { groupItem: { groupId: In([9]) } },
      }));
    });
  });
});
