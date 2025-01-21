import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, In } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import {
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  getNetwork,
} from '@app/common';
import {
  Notification,
  NotificationReceiver,
  NotificationType,
  Role,
  Transaction,
  TransactionApprover,
  TransactionStatus,
  UserKey,
} from '@entities';

import { ReceiverService } from './receiver.service';
import { FanOutService } from '../fan-out/fan-out.service';

jest.mock('@app/common');
jest.mock('murlock', () => {
  const original = jest.requireActual('murlock');
  return {
    ...original,
    MurLock: function MurLock() {
      return (target, propertyKey, descriptor) => {
        return descriptor;
      };
    },
  };
});

describe('ReceiverService', () => {
  let service: ReceiverService;
  const entityManager = mockDeep<EntityManager>();
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const fanOutService = mockDeep<FanOutService>();

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      return await passedFunction(entityManager);
    });
    entityManager.transaction.mockImplementation(transactionMock);
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiverService,
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: FanOutService,
          useValue: fanOutService,
        },
      ],
    }).compile();

    service = module.get<ReceiverService>(ReceiverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const getNotification = (): Notification => ({
    id: 1,
    type: NotificationType.TRANSACTION_CREATED,
    content: 'General notification content',
    entityId: 1,
    actorId: null,
    notificationReceivers: [],
    createdAt: new Date(),
  });

  const getNotificationReceivers = (): NotificationReceiver[] => [
    {
      id: 1,
      userId: 1,
      notificationId: 1,
      isRead: false,
      isEmailSent: null,
      isInAppNotified: null,
      updatedAt: new Date(),
      notification: getNotification(),
      user: null,
    },
    {
      id: 2,
      userId: 2,
      notificationId: 1,
      isRead: false,
      isEmailSent: null,
      isInAppNotified: null,
      updatedAt: new Date(),
      notification: getNotification(),
      user: null,
    },
  ];

  describe('fanOutIndicatorsDelete', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should call fanOutIndicatorsDelete with correct params', () => {
      const notificationReceivers: NotificationReceiver[] = [
        {
          id: 1,
          userId: 1,
          notificationId: 1,
          isRead: false,
          isEmailSent: null,
          isInAppNotified: null,
          updatedAt: new Date(),
          notification: getNotification(),
          user: null,
        },
        {
          id: 2,
          userId: 2,
          notificationId: 1,
          isRead: false,
          isEmailSent: null,
          isInAppNotified: null,
          updatedAt: new Date(),
          notification: getNotification(),
          user: null,
        },
        {
          id: 3,
          userId: 1,
          notificationId: 1,
          isRead: false,
          isEmailSent: null,
          isInAppNotified: null,
          updatedAt: new Date(),
          notification: getNotification(),
          user: null,
        },
      ];

      //@ts-expect-error fanOutIndicatorsDelete is private
      service.fanOutIndicatorsDelete(notificationReceivers);

      const userIdToNotificationReceiversId = {
        1: [1, 3],
        2: [2],
      };
      expect(fanOutService.fanOutIndicatorsDelete).toHaveBeenCalledWith(
        userIdToNotificationReceiversId,
      );
    });
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const type = NotificationType.TRANSACTION_CREATED;
      const content = 'some-content';
      const entityId = 1;
      const actorId = 1;

      //@ts-expect-error createNotification is private
      await service.createNotification(entityManager, type, content, entityId, actorId);

      expect(entityManager.create).toHaveBeenCalledWith(Notification, {
        type,
        content,
        entityId,
        actorId,
        notificationReceivers: [],
      });
      expect(entityManager.save).toHaveBeenCalled();
    });
  });

  describe('createReceivers', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      entityManager.create.mockImplementation((_, data) => data);
    });

    it('should add receivers', async () => {
      const notificationId = 1;
      const userIds = [1, 2, 3];

      //@ts-expect-error createReceivers is private
      await service.createReceivers(entityManager, notificationId, userIds, true);

      for (let i = 0; i < userIds.length; i++) {
        expect(entityManager.create).toHaveBeenNthCalledWith(i + 1, NotificationReceiver, {
          notificationId,
          userId: userIds[i],
          isRead: false,
          isInAppNotified: true,
          isEmailSent: null,
        });
      }
      expect(entityManager.create).toHaveBeenCalledTimes(userIds.length);
    });

    it('should continue adding receivers if one fails', async () => {
      const notificationId = 1;
      const userIds = [1, 2, 3];

      jest.spyOn(console, 'log').mockImplementationOnce(jest.fn());
      entityManager.save.mockRejectedValueOnce(new Error('Failed to save'));

      //@ts-expect-error createReceivers is private
      const notificationReceivers = await service.createReceivers(
        entityManager,
        notificationId,
        userIds,
        true,
      );

      for (let i = 0; i < userIds.length; i++) {
        expect(entityManager.create).toHaveBeenNthCalledWith(i + 1, NotificationReceiver, {
          notificationId,
          userId: userIds[i],
          isRead: false,
          isInAppNotified: true,
          isEmailSent: null,
        });
      }
      expect(entityManager.create).toHaveBeenCalledTimes(userIds.length);
      expect(notificationReceivers).toEqual([
        expect.objectContaining({ userId: 2 }),
        expect.objectContaining({ userId: 3 }),
      ]);
    });
  });

  describe('getIndicatorNotifications', () => {
    it('should return indicator notifications', async () => {
      const transactionId = 1;
      const indicatorTypes = [
        NotificationType.TRANSACTION_INDICATOR_APPROVE,
        NotificationType.TRANSACTION_INDICATOR_SIGN,
        NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
        NotificationType.TRANSACTION_INDICATOR_EXECUTED,
        NotificationType.TRANSACTION_INDICATOR_EXPIRED,
        NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
      ];

      //@ts-expect-error getIndicatorNotifications is private
      await service.getIndicatorNotifications(entityManager, transactionId);

      expect(entityManager.find).toHaveBeenCalledWith(Notification, {
        where: {
          entityId: transactionId,
          type: In(indicatorTypes),
        },
        relations: {
          notificationReceivers: true,
        },
      });
    });
  });

  describe('getTransactionParticipants', () => {
    const now = new Date();

    const transaction: Partial<Transaction> = {
      id: 1,
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      transactionId: '0.0.215914@1618316800',
      creatorKey: {
        id: 1,
        user: null,
        userId: 1,
        mnemonicHash: null,
        publicKey: '',
        index: null,
        deletedAt: null,
        approvedTransactions: [],
        signedTransactions: [],
        createdTransactions: [],
      },
      approvers: null,
      observers: [
        {
          id: 2,
          user: null,
          userId: 2,
          role: Role.FULL,
          transaction: null,
          transactionId: 1,
          createdAt: now,
        },
      ],
      signers: [
        {
          id: 1,
          user: null,
          userId: 8,
          transaction: null,
          transactionId: 1,
          createdAt: now,
          userKey: null,
          userKeyId: 3,
        },
      ],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const approvers: TransactionApprover[] = [
      {
        id: 1,
        user: null,
        userId: 1,
        approved: null,
        transaction: transaction as Transaction,
        transactionId: 1,
        approvers: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: 2,
        user: null,
        userId: null,
        listId: 1,
        transaction: transaction as Transaction,
        transactionId: 1,
        approvers: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: 3,
        user: null,
        userId: 5,
        approved: true,
        transaction: transaction as Transaction,
        transactionId: 1,
        approvers: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];
    const transactionId = 1;
    const usersIdsRequiredToSign = [1, 2, 3];

    it('should return transaction participants', async () => {
      entityManager.findOne.mockResolvedValueOnce(transaction);

      const getApproversByTransactionId: jest.SpyInstance = jest.spyOn(
        service,
        //@ts-expect-error getApproversByTransactionId is private
        'getApproversByTransactionId',
      );
      getApproversByTransactionId.mockResolvedValueOnce(approvers);

      const getUsersIdsRequiredToSign: jest.SpyInstance = jest
        //@ts-expect-error getUsersIdsRequiredToSign is private
        .spyOn(service, 'getUsersIdsRequiredToSign');
      getUsersIdsRequiredToSign.mockResolvedValueOnce(usersIdsRequiredToSign);

      //@ts-expect-error getTransactionParticipants is private
      const result = await service.getTransactionParticipants(entityManager, transactionId);

      // expect(result).toEqual({
      //   creatorId: 1,
      //   signerUserIds: expect.arrayContaining([8]),
      //   observerUserIds: expect.arrayContaining([2]),
      //   approversUserIds: expect.arrayContaining([1, 5]),
      //   requiredUserIds: expect.arrayContaining([1, 2, 3]),
      //   approversGaveChoiceUserIds: expect.arrayContaining([5]),
      //   approversShouldChooseUserIds: expect.arrayContaining([1]),
      //   participants: expect.arrayContaining([1, 2, 3, 5, 8]),
      // });
      // expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
      //   where: { id: transactionId },
      //   relations: {
      //     creatorKey: true,
      //     observers: true,
      //     signers: true,
      //   },
      // });
      expect(result).toEqual({
        approversUserIds: expect.arrayContaining([1, 5]),
        requiredUserIds: expect.arrayContaining([1, 2, 3]),
        approversGaveChoiceUserIds: expect.arrayContaining([5]),
        approversShouldChooseUserIds: expect.arrayContaining([1]),
        participants: expect.arrayContaining([1, 2, 3, 5]),
      });
      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
      });
      expect(getApproversByTransactionId).toHaveBeenCalledWith(entityManager, transactionId);
    });

    it('should return empty approver should choose if expired', async () => {
      const expiredTransaction = { ...transaction, status: TransactionStatus.EXPIRED };

      entityManager.findOne.mockResolvedValueOnce(expiredTransaction);

      const getApproversByTransactionId: jest.SpyInstance = jest.spyOn(
        service,
        //@ts-expect-error getApproversByTransactionId is private
        'getApproversByTransactionId',
      );
      getApproversByTransactionId.mockResolvedValueOnce(approvers);

      const getUsersIdsRequiredToSign: jest.SpyInstance = jest
        //@ts-expect-error getUsersIdsRequiredToSign is private
        .spyOn(service, 'getUsersIdsRequiredToSign');
      getUsersIdsRequiredToSign.mockResolvedValueOnce(usersIdsRequiredToSign);

      //@ts-expect-error getTransactionParticipants is private
      const result = await service.getTransactionParticipants(entityManager, transactionId);

      // expect(result).toEqual({
      //   creatorId: 1,
      //   signerUserIds: expect.arrayContaining([8]),
      //   observerUserIds: expect.arrayContaining([2]),
      //   approversUserIds: expect.arrayContaining([1, 5]),
      //   requiredUserIds: expect.arrayContaining([1, 2, 3]),
      //   approversGaveChoiceUserIds: expect.arrayContaining([5]),
      //   approversShouldChooseUserIds: [],
      //   participants: expect.arrayContaining([1, 2, 3, 5, 8]),
      // });
      // expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
      //   where: { id: transactionId },
      //   relations: {
      //     creatorKey: true,
      //     observers: true,
      //     signers: true,
      //   },
      // });
      expect(result).toEqual({
        approversUserIds: expect.arrayContaining([1, 5]),
        requiredUserIds: expect.arrayContaining([1, 2, 3]),
        approversGaveChoiceUserIds: expect.arrayContaining([5]),
        approversShouldChooseUserIds: [],
        participants: expect.arrayContaining([1, 2, 3, 5]),
      });
      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: transactionId },
      });
      expect(getApproversByTransactionId).toHaveBeenCalledWith(entityManager, transactionId);
    });
  });

  describe('getUsersIdsRequiredToSign', () => {
    it('should return users ids required to sign', async () => {
      const entityManager = mockDeep<EntityManager>();
      const transaction: Partial<Transaction> = {};

      const allKeys = [{ userId: 1 }, { userId: 2 }, { userId: 3 }, { userId: 1 }];

      jest.mocked(keysRequiredToSign).mockResolvedValueOnce(allKeys as UserKey[]);

      //@ts-expect-error getUsersIdsRequiredToSign is private
      const result = await service.getUsersIdsRequiredToSign(
        entityManager,
        transaction as Transaction,
      );

      expect(result).toEqual(expect.arrayContaining([1, 2, 3]));
    });
  });

  describe('getApproversByTransactionId', () => {
    it('should query the database for approvers', async () => {
      const transactionId = 1;

      //@ts-expect-error getApproversByTransactionId is private
      await service.getApproversByTransactionId(entityManager, transactionId);

      expect(entityManager.query).toHaveBeenCalledWith(expect.any(String), [transactionId]);
    });

    it('should return empty array if invalid transaction id is provided', async () => {
      const transactionId = null;

      //@ts-expect-error getApproversByTransactionId is private
      const result = await service.getApproversByTransactionId(entityManager, transactionId);

      expect(result).toEqual([]);
    });
  });

  describe('notifyGeneral', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      entityManager.create.mockImplementation((_, data) => data);
      mockTransaction();
    });

    it('should create a custom notification', async () => {
      const dto: NotifyGeneralDto = {
        userIds: [1, 2],
        type: NotificationType.TRANSACTION_CREATED,
        content: 'General notification content',
        entityId: 1,
        actorId: null,
      };

      const notification = getNotification();
      //@ts-expect-error createNotification is private
      jest.spyOn(service, 'createNotification').mockResolvedValueOnce(notification);

      const notificationReceivers = getNotificationReceivers();
      //@ts-expect-error createReceivers is private
      jest.spyOn(service, 'createReceivers').mockResolvedValueOnce(notificationReceivers);

      await service.notifyGeneral(dto);

      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(notification, notificationReceivers);
    });

    it('should use existing notification', async () => {
      const notification = getNotification();

      const dto: NotifyGeneralDto = {
        userIds: [1, 2],
        type: notification.type,
        content: notification.content,
        entityId: notification.entityId,
        actorId: notification.actorId,
      };

      entityManager.findOne.mockResolvedValueOnce(notification);

      //@ts-expect-error createNotification is private
      const createNotification = jest.spyOn(service, 'createNotification');

      await service.notifyGeneral(dto);

      expect(createNotification).not.toHaveBeenCalled();
      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(notification, [
        expect.objectContaining({ userId: 1 }),
        expect.objectContaining({ userId: 2 }),
      ]);
    });

    it('should not create a receiver if already exists', async () => {
      const notification = getNotification();
      const existingReceiver: NotificationReceiver = {
        id: 1,
        userId: 1,
        notificationId: 1,
        isRead: false,
        isEmailSent: null,
        isInAppNotified: null,
        updatedAt: new Date(),
        notification: notification,
        user: null,
      };
      notification.notificationReceivers = [existingReceiver];

      const userIds = [existingReceiver.userId, 2];

      const dto: NotifyGeneralDto = {
        userIds,
        type: notification.type,
        content: notification.content,
        entityId: notification.entityId,
        actorId: notification.actorId,
      };

      entityManager.findOne.mockResolvedValueOnce(notification);

      //@ts-expect-error createNotification is private
      const createNotification = jest.spyOn(service, 'createNotification');

      //@ts-expect-error createReceivers is private
      const createReceivers = jest.spyOn(service, 'createReceivers');

      await service.notifyGeneral(dto);

      expect(createNotification).not.toHaveBeenCalled();
      expect(createReceivers).toHaveBeenCalledWith(entityManager, notification.id, [userIds[1]]);
      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(notification, [
        expect.objectContaining({ userId: userIds[1] }),
      ]);
    });

    it('should do nothing if no userIds provided', async () => {
      const dto: NotifyGeneralDto = {
        userIds: [],
        type: NotificationType.TRANSACTION_CREATED,
        content: 'General notification content',
        entityId: 1,
        actorId: null,
      };

      await service.notifyGeneral(dto);

      expect(entityManager.transaction).not.toHaveBeenCalled();
      expect(fanOutService.fanOutNew).not.toHaveBeenCalled();
    });
  });

  describe('notifyTransactionRequiredSigners', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      entityManager.create.mockImplementation((_, data) => data);
    });

    it('should throw an error if transaction not found', async () => {
      entityManager.findOne.calledWith(Transaction, expect.anything()).mockResolvedValueOnce(null);

      const dto: NotifyForTransactionDto = { transactionId: 1 };

      await expect(service.notifyTransactionRequiredSigners(dto)).rejects.toThrow(
        'Transaction not found',
      );
    });

    it('should notify required signers without creator for a transaction', async () => {
      const dto: NotifyForTransactionDto = { transactionId: 1 };

      const creatorId = 1;
      const usersIdsRequiredToSign = [creatorId, 2, 3];

      const transaction: Partial<Transaction> = {
        id: 1,
        transactionId: '0.0.215914@1618316800',
        creatorKey: {
          id: 1,
          user: null,
          userId: creatorId,
          mnemonicHash: null,
          publicKey: '',
          index: null,
          deletedAt: null,
          approvedTransactions: [],
          signedTransactions: [],
          createdTransactions: [],
        },
        mirrorNetwork: 'testnet',
      };
      entityManager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      const getUsersIdsRequiredToSign: jest.SpyInstance = jest
        //@ts-expect-error getUsersIdsRequiredToSign is private
        .spyOn(service, 'getUsersIdsRequiredToSign');
      getUsersIdsRequiredToSign.mockResolvedValueOnce(usersIdsRequiredToSign);

      const notifyGeneral = jest.spyOn(service, 'notifyGeneral');
      notifyGeneral.mockImplementationOnce(jest.fn());

      const syncIndicators: jest.SpyInstance = jest.spyOn(service, 'syncIndicators');
      syncIndicators.mockImplementationOnce(jest.fn());

      await service.notifyTransactionRequiredSigners(dto);

      const networkString = getNetwork(transaction as Transaction);

      expect(entityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { id: dto.transactionId },
        relations: { creatorKey: true },
      });
      expect(getUsersIdsRequiredToSign).toHaveBeenCalledWith(entityManager, transaction);
      expect(notifyGeneral).toHaveBeenCalledWith({
        userIds: usersIdsRequiredToSign.filter(id => id !== creatorId),
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction.\n Transaction ID: ${transaction.transactionId}\n Network: ${networkString}`,
        entityId: 1,
        actorId: null,
      });
      expect(syncIndicators).toHaveBeenCalledWith({
        transactionId: 1,
        transactionStatus: transaction.status,
      });
    });
  });

  describe('syncActionIndicators', () => {
    beforeAll(() => {
      jest.restoreAllMocks();
    });

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should create a new indicator notification if not exists', async () => {
      const type = NotificationType.TRANSACTION_INDICATOR_APPROVE;
      const notification = null;
      const newNotification = getNotification();
      const notificationReceivers = getNotificationReceivers();
      const transactionId = 1;
      const userIds = notificationReceivers.map(receiver => receiver.userId);

      //@ts-expect-error createNotification is private
      const createNotification: jest.SpyInstance = jest.spyOn(service, 'createNotification');
      createNotification.mockResolvedValueOnce(newNotification);

      const fanOutIndicatorsDelete: jest.SpyInstance = jest.spyOn(
        service,
        //@ts-expect-error fanOutIndicatorsDelete is private
        'fanOutIndicatorsDelete',
      );

      //@ts-expect-error createReceivers is private
      const createReceivers: jest.SpyInstance = jest.spyOn(service, 'createReceivers');
      createReceivers.mockResolvedValueOnce(notificationReceivers);

      //@ts-expect-error syncActionIndicators is private
      await service.syncActionIndicators(entityManager, type, notification, transactionId, userIds);

      expect(fanOutIndicatorsDelete).toHaveBeenCalledWith([]);
      expect(createReceivers).toHaveBeenCalledWith(entityManager, newNotification.id, userIds);
      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(newNotification, notificationReceivers);
    });

    it('should remove indicator notification for users that should not take action and send to ones that should', async () => {
      const transactionId = 1;
      const type = NotificationType.TRANSACTION_INDICATOR_APPROVE;

      const notification = getNotification();
      const notificationReceivers = getNotificationReceivers();

      notification.notificationReceivers = notificationReceivers.slice(0, 1);

      const fanOutIndicatorsDelete: jest.SpyInstance = jest.spyOn(
        service,
        //@ts-expect-error fanOutIndicatorsDelete is private
        'fanOutIndicatorsDelete',
      );

      //@ts-expect-error createReceivers is private
      const createReceivers: jest.SpyInstance = jest.spyOn(service, 'createReceivers');
      createReceivers.mockResolvedValueOnce(notificationReceivers.slice(1));

      //@ts-expect-error syncActionIndicators is private
      await service.syncActionIndicators(entityManager, type, notification, transactionId, [
        notificationReceivers[1].userId,
      ]);

      expect(entityManager.delete).toHaveBeenCalledWith(NotificationReceiver, {
        id: In([notificationReceivers[0].id]),
      });
      expect(fanOutIndicatorsDelete).toHaveBeenCalledWith([notificationReceivers[0]]);
      expect(createReceivers).toHaveBeenCalledWith(entityManager, notification.id, [
        notificationReceivers[1].userId,
      ]);
      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(
        notification,
        notificationReceivers.slice(1),
      );
    });

    it('should send notification to new receivers even if deletion of previous receivers fails', async () => {
      const transactionId = 1;
      const type = NotificationType.TRANSACTION_INDICATOR_APPROVE;

      const notification = getNotification();
      const notificationReceivers = getNotificationReceivers();

      notification.notificationReceivers = notificationReceivers.slice(0, 1);

      jest.spyOn(console, 'log').mockImplementationOnce(jest.fn());
      entityManager.delete.mockRejectedValueOnce(new Error('Failed to delete'));
      const fanOutIndicatorsDelete: jest.SpyInstance = jest.spyOn(
        service,
        //@ts-expect-error fanOutIndicatorsDelete is private
        'fanOutIndicatorsDelete',
      );

      //@ts-expect-error createReceivers is private
      const createReceivers: jest.SpyInstance = jest.spyOn(service, 'createReceivers');
      createReceivers.mockResolvedValueOnce(notificationReceivers.slice(1));

      //@ts-expect-error syncActionIndicators is private
      await service.syncActionIndicators(entityManager, type, notification, transactionId, [
        notificationReceivers[1].userId,
      ]);

      expect(entityManager.delete).toHaveBeenCalledWith(NotificationReceiver, {
        id: In([notificationReceivers[0].id]),
      });
      expect(fanOutIndicatorsDelete).not.toHaveBeenCalled();
      expect(createReceivers).toHaveBeenCalledWith(entityManager, notification.id, [
        notificationReceivers[1].userId,
      ]);
      expect(fanOutService.fanOutNew).toHaveBeenCalledWith(
        notification,
        notificationReceivers.slice(1),
      );
    });
  });

  describe('syncIndicators', () => {
    beforeAll(() => {
      jest.restoreAllMocks();
    });

    beforeEach(() => {
      jest.resetAllMocks();
      mockTransaction();
    });

    it('should determine the correct new indicator type based on transaction status', async () => {
      const transactionId = 1;
      const participants = [3];

      const actAssert = async (
        transactionStatus: TransactionStatus,
        // notifyType: NotificationType,
      ) => {
        const getTransactionParticipants: jest.SpyInstance = jest
          //@ts-expect-error getTransactionParticipants is private
          .spyOn(service, 'getTransactionParticipants');
        getTransactionParticipants.mockResolvedValueOnce({
          participants,
          approversShouldChooseUserIds: [],
        });

        //@ts-expect-error getIndicatorNotifications is private
        jest.spyOn(service, 'getIndicatorNotifications').mockResolvedValueOnce([]);

        jest.spyOn(service, 'notifyGeneral').mockImplementationOnce(jest.fn());

        //@ts-expect-error getIndicatorNotifications is private
        jest.spyOn(service, 'getIndicatorNotifications').mockResolvedValueOnce([]);

        //@ts-expect-error syncActionIndicators is private
        jest.spyOn(service, 'syncActionIndicators').mockResolvedValueOnce([]);

        await service.syncIndicators({ transactionId, transactionStatus });

        expect(entityManager.delete).not.toHaveBeenCalled();
        expect(fanOutService.fanOutIndicatorsDelete).not.toHaveBeenCalled();
        // expect(service.notifyGeneral).toHaveBeenCalledWith({
        //   type: notifyType,
        //   content: '',
        //   entityId: transactionId,
        //   actorId: null,
        //   userIds: participants,
        // });
        //@ts-expect-error syncActionIndicators is private
        expect(service.syncActionIndicators).toHaveBeenCalledWith(
          entityManager,
          NotificationType.TRANSACTION_INDICATOR_APPROVE,
          undefined,
          transactionId,
          [],
        );
      };

      await actAssert(TransactionStatus.EXECUTED);
      await actAssert(TransactionStatus.FAILED);
      await actAssert(TransactionStatus.EXPIRED);
      await actAssert(TransactionStatus.WAITING_FOR_EXECUTION);
      await actAssert(TransactionStatus.ARCHIVED);
    });

    it('should delete previuos notifications and do nothing more if there is not new indicator type', async () => {
      const transactionId = 1;
      const transactionStatus = TransactionStatus.CANCELED;

      const existingIndicatorNotifications = [
        {
          id: 1,
          type: NotificationType.TRANSACTION_INDICATOR_APPROVE,
          content: 'Approve',
          entityId: transactionId,
          actorId: null,
          notificationReceivers: [
            {
              id: 1,
              userId: 1,
              notificationId: 1,
              isRead: false,
              isEmailSent: null,
              isInAppNotified: null,
              updatedAt: new Date(),
              notification: null,
              user: null,
            },
          ],
          createdAt: new Date(),
        },
      ];
      const getTransactionParticipants: jest.SpyInstance = jest
        //@ts-expect-error getTransactionParticipants is private
        .spyOn(service, 'getTransactionParticipants');
      getTransactionParticipants.mockResolvedValueOnce({
        participants: [],
      });

      const getIndicatorNotifications: jest.SpyInstance = jest
        //@ts-expect-error getIndicatorNotifications is private
        .spyOn(service, 'getIndicatorNotifications');
      getIndicatorNotifications.mockResolvedValueOnce(existingIndicatorNotifications);

      await service.syncIndicators({ transactionId, transactionStatus });

      expect(entityManager.transaction).toHaveBeenCalled();
      expect(entityManager.delete).toHaveBeenCalledWith(Notification, {
        id: In([1]),
      });
      expect(entityManager.delete).toHaveBeenCalledWith(NotificationReceiver, {
        id: In([1]),
      });
      expect(fanOutService.fanOutIndicatorsDelete).toHaveBeenCalledWith({
        1: [1],
      });
    });

    it('should sync sign indicators if the new indicator type is sign', async () => {
      const transactionId = 1;
      const transactionStatus = TransactionStatus.WAITING_FOR_SIGNATURES;

      const participants = [3];
      const oldIndicatorNotifications = [
        {
          id: 1,
          type: NotificationType.TRANSACTION_INDICATOR_SIGN,
          content: 'Sign',
          entityId: transactionId,
          actorId: null,
          notificationReceivers: [],
          createdAt: new Date(),
        },
      ];

      const getTransactionParticipants: jest.SpyInstance = jest
        //@ts-expect-error getTransactionParticipants is private
        .spyOn(service, 'getTransactionParticipants');
      getTransactionParticipants.mockResolvedValueOnce({
        participants,
        approversShouldChooseUserIds: [],
        requiredUserIds: [32],
      });

      const getIndicatorNotifications: jest.SpyInstance = jest
        //@ts-expect-error getIndicatorNotifications is private
        .spyOn(service, 'getIndicatorNotifications');
      getIndicatorNotifications.mockResolvedValueOnce(oldIndicatorNotifications);

      jest.spyOn(service, 'notifyGeneral').mockImplementationOnce(jest.fn());

      getIndicatorNotifications.mockResolvedValueOnce(oldIndicatorNotifications);

      //@ts-expect-error syncActionIndicators is private
      const syncActionIndicators: jest.SpyInstance = jest.spyOn(service, 'syncActionIndicators');
      syncActionIndicators.mockImplementationOnce(jest.fn());
      syncActionIndicators.mockImplementationOnce(jest.fn());

      await service.syncIndicators({ transactionId, transactionStatus });

      expect(entityManager.delete).not.toHaveBeenCalled();
      expect(fanOutService.fanOutIndicatorsDelete).not.toHaveBeenCalled();
      expect(service.notifyGeneral).not.toHaveBeenCalled();
      //@ts-expect-error syncActionIndicators is private
      expect(service.syncActionIndicators).toHaveBeenCalledWith(
        entityManager,
        NotificationType.TRANSACTION_INDICATOR_SIGN,
        oldIndicatorNotifications[0],
        transactionId,
        [32],
      );
      expect(syncActionIndicators).toHaveBeenCalledWith(
        entityManager,
        NotificationType.TRANSACTION_INDICATOR_APPROVE,
        undefined,
        transactionId,
        [],
      );
    });
  });
});
