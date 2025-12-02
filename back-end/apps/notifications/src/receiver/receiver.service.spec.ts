import { Test } from '@nestjs/testing';
import { ReceiverService } from './receiver.service';
import { EntityManager, In } from 'typeorm';

import { MirrorNodeService } from '@app/common';
import { NatsPublisherService } from '@app/common/nats/nats.publisher';

import {
  NotificationReceiver,
  NotificationType,
  Transaction,
  TransactionStatus,
} from '@entities';

import {
  emitDeleteNotifications,
  emitEmailNotifications,
  emitNewNotifications,
} from './emit-notifications';

import { keysRequiredToSign } from '@app/common';

// ------------------ MOCKS -----------------------

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
});

const mockMirror = () => ({
  someMethod: jest.fn(),
});

const mockPublisher = () => ({
  publish: jest.fn(),
});

// ------------------------------------------------

describe('ReceiverService', () => {
  let service: ReceiverService;
  let em: ReturnType<typeof mockEntityManager>;
  let mirror: ReturnType<typeof mockMirror>;
  let publisher: ReturnType<typeof mockPublisher>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReceiverService,
        { provide: EntityManager, useFactory: mockEntityManager },
        { provide: MirrorNodeService, useFactory: mockMirror },
        { provide: NatsPublisherService, useFactory: mockPublisher },
      ],
    }).compile();

    service = module.get(ReceiverService);
    em = module.get(EntityManager);
    mirror = module.get(MirrorNodeService);
    publisher = module.get(NatsPublisherService);

    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  //  BASIC LOOKUP TESTS
  // ------------------------------------------------------------------

  it('getInAppNotificationType returns correct mapping', () => {
    const result = (service as any).getInAppNotificationType(
      TransactionStatus.EXECUTED
    );
    expect(result).toBe(NotificationType.TRANSACTION_INDICATOR_EXECUTED);
  });

  it('getEmailNotificationType returns correct mapping', () => {
    const result = (service as any).getEmailNotificationType(
      TransactionStatus.EXPIRED
    );
    expect(result).toBe(NotificationType.TRANSACTION_EXPIRED);
  });

  // ------------------------------------------------------------------
  //  fetchTransactionsWithRelations
  // ------------------------------------------------------------------

  it('fetchTransactionsWithRelations returns map of transactions', async () => {
    const tx = { id: 1 };
    em.find.mockResolvedValue([tx]);

    const result = await (service as any).fetchTransactionsWithRelations([1], {});

    expect(em.find).toHaveBeenCalledWith(Transaction, expect.any(Object));
    expect(result.get(1)).toBe(tx);
  });

  // ------------------------------------------------------------------
  //  getApproversByTransactionIds
  // ------------------------------------------------------------------

  it('getApproversByTransactionIds groups approvers by transaction', async () => {
    em.query.mockResolvedValue([
      { id: 10, transactionId: 1, userId: 50 },
      { id: 11, transactionId: 1, userId: 51 },
      { id: 12, transactionId: 2, userId: 52 },
    ]);

    const result = await (service as any).getApproversByTransactionIds(em, [1, 2]);

    expect(result.get(1).length).toBe(2);
    expect(result.get(2).length).toBe(1);
  });

  // ------------------------------------------------------------------
  //  getUsersIdsRequiredToSign
  // ------------------------------------------------------------------

  it('getUsersIdsRequiredToSign uses keysRequiredToSign', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([
      { userId: 10 },
      { userId: 11 },
    ]);

    const tx = { some: 'data' };

    const result = await (service as any).getUsersIdsRequiredToSign(em, tx);

    expect(keysRequiredToSign).toHaveBeenCalled();
    expect(result).toEqual([10, 11]);
  });

  // ------------------------------------------------------------------
  //  getTransactionParticipants
  // ------------------------------------------------------------------

  it('getTransactionParticipants computes properly', async () => {
    (keysRequiredToSign as jest.Mock).mockResolvedValue([{ userId: 100 }]);

    const tx = {
      creatorKey: { userId: 1 },
      signers: [{ userId: 2 }],
      observers: [{ userId: 3 }],
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
    };

    const approvers = [
      { userId: 4, approved: null },
      { userId: 5, approved: true },
    ];

    const result = await (service as any).getTransactionParticipants(
      em,
      tx,
      approvers,
      new Map()
    );

    expect(result.participants).toContain(1);
    expect(result.participants).toContain(100);
  });

  // ------------------------------------------------------------------
  //  getNotificationReceiverIds
  // ------------------------------------------------------------------

  it('getNotificationReceiverIds: SIGNING -> required users only', async () => {
    const parts = {
      requiredUserIds: [99],
      approversUserIds: [88],
      observerUserIds: [77],
      creatorId: 66,
    };

    jest.spyOn(service as any, 'getTransactionParticipants').mockResolvedValue(parts);

    const tx = { status: TransactionStatus.WAITING_FOR_SIGNATURES };

    const ids = await (service as any).getNotificationReceiverIds(
      em,
      tx,
      NotificationType.TRANSACTION_INDICATOR_SIGN,
      [],
      new Map()
    );

    expect(ids).toEqual([99]);
  });

  // ------------------------------------------------------------------
  //  filterReceiversByPreferenceForType
  // ------------------------------------------------------------------

  it('filterReceiversByPreferenceForType filters by user preferences', async () => {
    em.find.mockResolvedValue([
      { id: 1, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, inApp: false }] },
      { id: 2, notificationPreferences: [{ type: NotificationType.TRANSACTION_EXECUTED, inApp: true }] },
    ]);

    const cache = new Map();
    const ids = await (service as any).filterReceiversByPreferenceForType(
      em,
      NotificationType.TRANSACTION_EXECUTED,
      new Set([1, 2]),
      cache
    );

    expect(ids).toEqual([2]);
  });

  // ------------------------------------------------------------------
  //  createNotificationReceivers
  // ------------------------------------------------------------------

  it('createNotificationReceivers saves proper rows', async () => {
    em.save.mockResolvedValue([{ id: 500 }]);

    const notification = { id: 99, type: NotificationType.TRANSACTION_EXECUTED };
    const receivers = await (service as any).createNotificationReceivers(em, notification, [1, 2]);

    expect(em.save).toHaveBeenCalled();
    expect(receivers[0].id).toBe(500);
  });

  // ------------------------------------------------------------------
  //  deleteExistingIndicators
  // ------------------------------------------------------------------

  it('deleteExistingIndicators deletes notifications + receivers', async () => {
    const nr = [{ id: 10, userId: 1 }];
    em.find.mockResolvedValue([
      { id: 100, notificationReceivers: nr },
    ]);

    em.delete.mockResolvedValue({});

    const result = await (service as any).deleteExistingIndicators(em, {
      id: 5,
    });

    expect(em.delete).toHaveBeenCalledTimes(2);
    expect(result[0]).toEqual({ userId: 1, receiverId: 10 });
  });

  // ------------------------------------------------------------------
  //  processNotificationType
  // ------------------------------------------------------------------

  it('processNotificationType creates new receivers if needed', async () => {
    em.findOne.mockResolvedValue({
      id: 10,
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      notificationReceivers: [{ id: 700, userId: 1 }],
    });
    em.find.mockResolvedValue([{ id: 700, userId: 1, isEmailSent: false }]);

    jest
      .spyOn(service as any, 'filterReceiversByPreferenceForType')
      .mockResolvedValue([1, 2]); // user 2 is new

    em.save.mockResolvedValue([{ id: 800, userId: 2 }]);

    const result = await (service as any).processNotificationType(
      em,
      55,
      NotificationType.TRANSACTION_EXECUTED,
      new Set([1, 2]),
      new Map()
    );

    expect(result.newReceivers.length).toBe(1);
    expect(result.updatedReceivers.length).toBe(1);
  });

  // ------------------------------------------------------------------
  //  processReminderEmail
  // ------------------------------------------------------------------

  it('processReminderEmail always creates a new notification', async () => {
    const tx = { id: 1 };

    em.save.mockResolvedValue({ id: 900 });

    jest.spyOn(service as any, 'filterReceiversByPreferenceForType').mockResolvedValue([10]);
    jest.spyOn(service as any, 'createNotificationReceivers').mockResolvedValue([{ id: 901 }]);

    const res = await (service as any).processReminderEmail(
      em,
      tx,
      new Set([10]),
      new Map()
    );

    expect(em.save).toHaveBeenCalled();
    expect(res[0].id).toBe(901);
  });

  // ------------------------------------------------------------------
  //  sendDeletionNotifications
  // ------------------------------------------------------------------

  it('sendDeletionNotifications emits deletion events', async () => {
    await (service as any).sendDeletionNotifications({ 1: [100, 101] });

    expect(emitDeleteNotifications).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  //  sendInAppNotifications
  // ------------------------------------------------------------------

  it('sendInAppNotifications updates in-app flags', async () => {
    em.update.mockResolvedValue({});

    await (service as any).sendInAppNotifications(
      { 1: [{ id: 10 }, { id: 11 }] },
      [10, 11]
    );

    expect(emitNewNotifications).toHaveBeenCalled();
    expect(em.update).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  //  sendEmailNotifications
  // ------------------------------------------------------------------

  it('sendEmailNotifications marks email sent', async () => {
    em.update.mockResolvedValue({});

    // emitEmailNotifications signature: (publisher, dtos, onSuccess, onError)
    (emitEmailNotifications as jest.Mock).mockImplementation(
      async (pub, dtos, onSuccess, onError) => {
        await onSuccess();
      }
    );

    await (service as any).sendEmailNotifications(
      { 'test@example.com': [{ id: 1 }] },
      [99]
    );

    expect(em.update).toHaveBeenCalledWith(
      NotificationReceiver,
      { id: In([99]) },
      { isEmailSent: true }
    );
  });
});