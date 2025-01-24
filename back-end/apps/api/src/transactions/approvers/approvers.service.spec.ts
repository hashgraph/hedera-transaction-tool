import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, mockDeep } from 'jest-mock-extended';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AccountCreateTransaction } from '@hashgraph/sdk';

import { ErrorCodes, MirrorNodeService, NOTIFICATIONS_SERVICE } from '@app/common';
import {
  attachKeys,
  userKeysRequiredToSign,
  verifyTransactionBodyWithoutNodeAccountIdSignature,
  notifyTransactionAction,
  notifySyncIndicators,
} from '@app/common/utils';
import { Transaction, TransactionApprover, TransactionStatus, User } from '@entities';

import { ApproversService } from './approvers.service';
import {
  ApproverChoiceDto,
  CreateTransactionApproversArrayDto,
  UpdateTransactionApproverDto,
} from '../dto';

jest.mock('@app/common/utils');

const expectNotifyNotCalled = () => {
  expect(notifyTransactionAction).not.toHaveBeenCalled();
  expect(notifySyncIndicators).not.toHaveBeenCalled();
};

describe('ApproversService', () => {
  let service: ApproversService;

  const approversRepo = mockDeep<Repository<TransactionApprover>>();
  const dataSource = mockDeep<DataSource>();
  const mirrorNodeService = mock<MirrorNodeService>();
  const notificationsService = mock<ClientProxy>();

  const user = {
    id: 1,
    keys: [
      { id: 3, publicKey: '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4' },
    ],
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproversService,
        {
          provide: getRepositoryToken(TransactionApprover),
          useValue: approversRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: MirrorNodeService,
          useValue: mirrorNodeService,
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<ApproversService>(ApproversService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactionApproverById', () => {
    it('should return approver by id with repo', async () => {
      const id = 1;
      const approver = new TransactionApprover();
      approver.id = id;
      approversRepo.findOne.mockResolvedValue(approver);

      const result = await service.getTransactionApproverById(id);

      expect(result).toEqual(approver);
    });

    it('should retun approver by id with entity manager', async () => {
      const id = 1;
      const approver = new TransactionApprover();
      approver.id = id;
      dataSource.manager.findOne.mockResolvedValue(approver);

      const result = await service.getTransactionApproverById(id, dataSource.manager);

      expect(result).toEqual(approver);
    });

    it('should return null if id is null', async () => {
      const result = await service.getTransactionApproverById(null);

      expect(result).toBeNull();
    });
  });

  describe('getApproversByTransactionId', () => {
    it('should query for approvers for user id with repo', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(transactionId, user.id);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [transactionId, user.id]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers for user id with entity manager', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(
        transactionId,
        user.id,
        dataSource.manager,
      );

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [
        transactionId,
        user.id,
      ]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers with entity manager', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(
        transactionId,
        undefined,
        dataSource.manager,
      );

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [transactionId]);
      expect(result).toEqual(approvers);
    });

    it('should query for approvers with repo', async () => {
      const transactionId = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getApproversByTransactionId(transactionId);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [transactionId]);
      expect(result).toEqual(approvers);
    });

    it('should return null if transaction id is null', async () => {
      const result = await service.getApproversByTransactionId(null);

      expect(result).toBeNull();
    });
  });

  describe('getVerifiedApproversByTransactionId', () => {
    it('should get transaction appovers by transaction id if user is creator', async () => {
      const transactionId = 1;
      const transaction = { creatorKey: { userId: user.id } };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is observer', async () => {
      const transactionId = 1;
      const observers = [{ userId: user.id }];
      const transaction = { id: transactionId, observers, signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is signer', async () => {
      const transactionId = 1;
      const signers = [{ userKey: { userId: user.id } }];
      const transaction = { id: transactionId, observers: [], signers };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get appovers if user is approver', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      const approvers = [{ userId: user.id }] as TransactionApprover[];
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue(approvers);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should get transaction appovers when transaction is visible for everyone', async () => {
      const transactionId = 1;
      const observers = [{ userId: 2 }, { userId: 3 }];
      const transaction = {
        creatorKey: { userId: user.id },
        status: TransactionStatus.EXECUTED,
        observers,
      };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).resolves.not.toThrow();
    });

    it('should throw not found exception', async () => {
      const transactionId = 1;
      dataSource.manager.findOne.mockResolvedValue(null);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).rejects.toThrow(ErrorCodes.TNF);
    });

    it('should throw if user has not access to this transaction', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, observers: [], signers: [] };
      dataSource.manager.findOne.mockResolvedValue(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);

      await expect(
        service.getVerifiedApproversByTransactionId(transactionId, user),
      ).rejects.toThrow("You don't have permission to view this transaction");
    });
  });

  describe('getTransactionApproversById', () => {
    it('should return approvers by id with repo', async () => {
      const id = 1;
      const approvers = [new TransactionApprover()];
      approversRepo.query.mockResolvedValue(approvers);

      const result = await service.getTransactionApproversById(id);

      expect(approversRepo.query).toHaveBeenCalledWith(expect.anything(), [id]);
      expect(result).toEqual(approvers);
    });

    it('should return approvers by id with entity manager', async () => {
      const id = 1;
      const approvers = [new TransactionApprover()];
      dataSource.manager.query.mockResolvedValue(approvers);

      const result = await service.getTransactionApproversById(id, dataSource.manager);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [id]);
      expect(result).toEqual(approvers);
    });

    it('should throw if id is null', async () => {
      await expect(service.getTransactionApproversById(null)).rejects.toThrow(ErrorCodes.TNF);
    });
  });

  describe('getRootNodeFromNode', () => {
    it('should send query with the node id', async () => {
      const nodeId = 1;

      await service.getRootNodeFromNode(nodeId);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [nodeId]);
    });

    it('should return null if id is null', async () => {
      const result = await service.getRootNodeFromNode(null);

      expect(result).toBeNull();
    });
  });

  describe('removeNode', () => {
    it('should remove node by id', async () => {
      const nodeId = 1;

      await service.removeNode(nodeId);

      expect(dataSource.manager.query).toHaveBeenCalledWith(expect.anything(), [nodeId]);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should return null if id is null', async () => {
      const result = await service.removeNode(null);

      expect(result).toBeNull();
    });

    it('should return null if id is not number', async () => {
      //@ts-expect-error test case
      const result = await service.getRootNodeFromNode('sd');

      expect(result).toBeNull();
    });
  });

  const mockTransaction = () => {
    const transactionMock = jest.fn(async passedFunction => {
      await passedFunction(dataSource.manager);
    });
    dataSource.transaction.mockImplementation(transactionMock);
  };

  describe('createTransactionApprovers', () => {
    const transaction = {
      id: 1,
      creatorKey: { userId: user.id },
      status: TransactionStatus.EXPIRED,
      mirrorNetwork: 'testnet',
    };

    beforeEach(() => {
      jest.resetAllMocks();

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      mockTransaction();
    });

    it('should create basic transaction approver', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
          },
        ],
      };

      approversRepo.count.mockResolvedValueOnce(0);
      dataSource.manager.count.calledWith(User, expect.anything()).mockResolvedValueOnce(1);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await service.createTransactionApprovers(user, transactionId, dto);

      expect(dataSource.manager.create).toHaveBeenCalledWith(TransactionApprover, {
        userId: 1,
        transactionId: transaction.id,
        threshold: null,
      });
      expect(dataSource.manager.insert).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should create nested transaction approver', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            threshold: 2,
            approvers: [
              {
                threshold: 1,
                approvers: [
                  {
                    userId: 1,
                  },
                  {
                    userId: 2,
                  },
                ],
              },
              {
                userId: 3,
                approvers: [],
              },
            ],
          },
        ],
      };

      approversRepo.count.mockResolvedValueOnce(0);
      dataSource.manager.count.calledWith(User, expect.anything()).mockResolvedValueOnce(1);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValue([]);
      dataSource.manager.create.mockImplementationOnce(
        jest.fn((_entity, data) => ({ ...data, id: 1 })),
      );
      dataSource.manager.create.mockImplementationOnce(
        jest.fn((_entity, data) => ({ ...data, id: 2 })),
      );
      dataSource.manager.create.mockImplementationOnce(
        jest.fn((_entity, data) => ({ ...data, id: 3 })),
      );
      dataSource.manager.create.mockImplementationOnce(
        jest.fn((_entity, data) => ({ ...data, id: 4 })),
      );
      dataSource.manager.create.mockImplementationOnce(
        jest.fn((_entity, data) => ({ ...data, id: 5 })),
      );
      dataSource.manager.findOne.mockResolvedValueOnce({ id: 1, threshold: 2 });
      dataSource.manager.findOne.mockResolvedValueOnce({ id: 2, threshold: 1 });
      dataSource.manager.findOne.mockResolvedValueOnce({ id: 2, threshold: 1 });
      dataSource.manager.findOne.mockResolvedValueOnce({ id: 1, threshold: 2 });
      jest.spyOn(service, 'getRootNodeFromNode').mockImplementation(
        jest.fn(
          async () =>
            ({
              id: 1,
              threshold: 2,
              transactionId: transaction.id,
            }) as TransactionApprover,
        ),
      );
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await service.createTransactionApprovers(user, transactionId, dto);

      expect(dataSource.manager.insert).toHaveBeenNthCalledWith(1, TransactionApprover, {
        id: 1,
        transactionId: transaction.id,
        threshold: 2,
        listId: undefined,
        userId: undefined,
      });
      expect(dataSource.manager.insert).toHaveBeenNthCalledWith(2, TransactionApprover, {
        id: 2,
        transactionId: null,
        threshold: 1,
        listId: 1,
        userId: undefined,
      });
      expect(dataSource.manager.insert).toHaveBeenNthCalledWith(3, TransactionApprover, {
        id: 3,
        transactionId: null,
        threshold: null,
        listId: 2,
        userId: 1,
      });
      expect(dataSource.manager.insert).toHaveBeenNthCalledWith(4, TransactionApprover, {
        id: 4,
        transactionId: null,
        threshold: null,
        listId: 2,
        userId: 2,
      });
      expect(dataSource.manager.insert).toHaveBeenNthCalledWith(5, TransactionApprover, {
        id: 5,
        transactionId: null,
        threshold: null,
        listId: 1,
        userId: 3,
      });
      expect(dataSource.manager.insert).toHaveBeenCalledTimes(5);
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should fail empty approver', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [{}],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Cannot create empty approver',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver with both user id and threshold', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
            threshold: 2,
          },
        ],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Children must be set when there is a threshold',
      );
    });

    it('should fail create basic transaction approver with a non existing user', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
          },
        ],
      };

      approversRepo.count.mockResolvedValueOnce(0);
      dataSource.manager.count.calledWith(User, expect.anything()).mockResolvedValueOnce(0);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValueOnce([]);

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'User with id: 1 not found',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver with threshold but no children', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            threshold: 2,
          },
        ],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Children must be set when there is a threshold',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver with threshold an user id', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
            threshold: 2,
            approvers: [
              {
                userId: 2,
              },
            ],
          },
        ],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'You can only set a user or a tree of approvers, not both',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver with a tree but without a threshold', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            approvers: [
              {
                userId: 2,
              },
            ],
          },
        ],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Threshold must be set for the parent approver',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver with a tree and invalid threshold', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            threshold: 412,
            approvers: [
              {
                userId: 2,
              },
            ],
          },
        ],
      };

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Threshold must be less or equal to the number of approvers (1) and not 0',
      );
      expectNotifyNotCalled();
    });

    it('should fail on approver that already exists', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 2,
          },
        ],
      };

      dataSource.manager.count.mockResolvedValueOnce(1);
      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Approver already exists',
      );
      expectNotifyNotCalled();
    });

    it('should fail on attaching a child to a non-existent parent', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            listId: 2,
          },
        ],
      };

      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Parent approver not found',
      );
      expectNotifyNotCalled();
    });

    it('should fail on attaching a child to a parent on different transaction', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            listId: 2,
          },
        ],
      };

      dataSource.manager.findOne.mockResolvedValueOnce({ id: 2, threshold: 2 });
      jest.spyOn(service, 'getRootNodeFromNode').mockImplementation(
        jest.fn(
          async () =>
            ({
              id: 1,
              threshold: 2,
              transactionId: 123123123123,
            }) as TransactionApprover,
        ),
      );
      await expect(service.createTransactionApprovers(user, transactionId, dto)).rejects.toThrow(
        'Root transaction is not the same',
      );
      expectNotifyNotCalled();
    });

    it('should create basic transaction approver that is already added', async () => {
      const transactionId = 1;
      const dto: CreateTransactionApproversArrayDto = {
        approversArray: [
          {
            userId: 1,
          },
        ],
      };

      approversRepo.count.mockResolvedValueOnce(0);
      dataSource.manager.count.calledWith(User, expect.anything()).mockResolvedValueOnce(1);
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: 1,
          transactionId: transaction.id,
          signature: Buffer.from('0x123'),
          userKeyId: 1,
          approved: true,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await service.createTransactionApprovers(user, transactionId, dto);

      expect(dataSource.manager.create).toHaveBeenCalledWith(TransactionApprover, {
        userId: 1,
        transactionId: transaction.id,
        threshold: null,
        signature: Buffer.from('0x123'),
        userKeyId: 1,
        approved: true,
      });
      expect(dataSource.manager.insert).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });
  });

  describe('updateTransactionApprover', () => {
    const transaction = {
      id: 1,
      creatorKey: { userId: user.id },
      status: TransactionStatus.WAITING_FOR_EXECUTION,
      mirrorNetwork: 'testnet',
    };

    const basicApprover: TransactionApprover = {
      id: 1,
      transactionId: 1,
      userId: 1,
      listId: undefined,
      threshold: null,
      approvers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const treeChild = {
      id: 3,
      transactionId: null,
      userId: 1,
      listId: 2,
      threshold: null,
      approvers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const treeApprover: TransactionApprover = {
      id: 2,
      transactionId: 1,
      userId: null,
      threshold: 2,
      listId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      approvers: [
        { ...treeChild },
        {
          id: 4,
          transactionId: null,
          userId: 2,
          listId: 2,
          threshold: null,
          approvers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    };

    const treeApprover2: TransactionApprover = {
      id: 5,
      transactionId: 1,
      userId: null,
      threshold: 1,
      listId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      approvers: [
        {
          id: 6,
          transactionId: null,
          userId: 7,
          listId: 5,
          threshold: null,
          approvers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    };

    beforeEach(() => {
      jest.resetAllMocks();

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      mockTransaction();
    });

    it('should update basic transaction approver', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      dataSource.manager.count.mockResolvedValueOnce(1);
      dataSource.manager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      await service.updateTransactionApprover(1, dto, transactionId, user);

      expect(dataSource.manager.update).toHaveBeenCalledWith(TransactionApprover, 1, {
        userId: 12,
        userKeyId: undefined,
        signature: undefined,
        approved: undefined,
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should do nothing if approver user id updated with the same user id', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: basicApprover.userId,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getApproversByTransactionId').mockResolvedValueOnce([]);
      dataSource.manager.count.mockResolvedValueOnce(1);

      await service.updateTransactionApprover(1, dto, transactionId, user);

      expect(dataSource.manager.update).not.toHaveBeenCalled();
      expectNotifyNotCalled();
    });

    it('should fail on update of non existing approver', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce(null);

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        ErrorCodes.ANF,
      );
      expectNotifyNotCalled();
    });

    it('should fail on update of approver without root', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce(null);

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        ErrorCodes.RANF,
      );
      expectNotifyNotCalled();
    });

    it('should fail on update of an approver with non existing user', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      dataSource.manager.count.mockResolvedValueOnce(0);

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'User with id: 12 not found',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update of an approver with non existing user', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      dataSource.manager.count.mockResolvedValueOnce(0);

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'User with id: 12 not found',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update many properties of an approver', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
        threshold: 3,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'Only one property of the approver can be update user id, list id, or the threshold',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update nested approver with user id ', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        userId: 12,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'Cannot update user id, the approver is a tree',
      );
      expectNotifyNotCalled();
    });

    it('should update attach approver to a tree', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 5,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce(treeApprover2);
      jest
        .spyOn(service, 'getTransactionApproversById')
        .mockResolvedValueOnce([treeApprover.approvers[0], treeApprover.approvers[1]]);
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce(treeApprover2);
      dataSource.manager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      await service.updateTransactionApprover(1, dto, transactionId, user);

      expect(dataSource.manager.update).toHaveBeenCalledWith(TransactionApprover, 1, {
        listId: 5,
        transactionId: null,
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should fail on update listId if parent (listId approver) not found', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 5,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce(null);

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'Parent approver not found',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update listId if parent (listId approver) is not tree', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 5,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...basicApprover });

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'Threshold must be set for the parent approver',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update transaction is different', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 5,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest
        .spyOn(service, 'getRootNodeFromNode')
        .mockResolvedValueOnce({ ...basicApprover, transactionId: 2 });

      await expect(service.updateTransactionApprover(1, dto, transactionId, user)).rejects.toThrow(
        'Root transaction is not the same',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update listId if the new list id is child of the updated approver', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 3,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({
          id: 3,
          transactionId: null,
          userId: 1,
          listId: 2,
          threshold: 3,
          approvers: [
            /* some children */
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });
      jest
        .spyOn(service, 'getTransactionApproversById')
        .mockResolvedValueOnce([treeApprover.approvers[0], treeApprover.approvers[1]]);
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });

      await expect(service.updateTransactionApprover(3, dto, transactionId, user)).rejects.toThrow(
        'Cannot set a child as a parent',
      );
      expectNotifyNotCalled();
    });

    it('should fail on update listId if the parent is not in same transaction', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: 3,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...treeApprover2, transactionId: 2 });
      jest.spyOn(service, 'getTransactionApproversById').mockResolvedValueOnce([]);
      jest
        .spyOn(service, 'getRootNodeFromNode')
        .mockResolvedValueOnce({ ...treeApprover2, transactionId: 2 });

      await expect(service.updateTransactionApprover(3, dto, transactionId, user)).rejects.toThrow(
        'Root transaction is not the same',
      );
      expectNotifyNotCalled();
    });

    it('should do nothing if update list id that is null with null', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: null,
      };

      jest
        .spyOn(service, 'getTransactionApproverById')
        .mockResolvedValueOnce({ ...basicApprover, listId: null });
      jest
        .spyOn(service, 'getRootNodeFromNode')
        .mockResolvedValueOnce({ ...basicApprover, listId: null });

      await service.updateTransactionApprover(1, dto, transactionId, user);

      expect(dataSource.manager.update).not.toHaveBeenCalled();
      expectNotifyNotCalled();
    });

    it('should update child to a tree', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: null,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeChild });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      await service.updateTransactionApprover(treeChild.id, dto, transactionId, user);

      expect(dataSource.manager.update).toHaveBeenNthCalledWith(
        1,
        TransactionApprover,
        treeChild.id,
        {
          listId: null,
          transactionId: transactionId,
        },
      );
      expect(dataSource.manager.update).toHaveBeenNthCalledWith(
        2,
        TransactionApprover,
        treeApprover.id,
        {
          threshold: 1,
        },
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should soft remove tree if no children left', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        listId: null,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeChild });
      jest
        .spyOn(service, 'getRootNodeFromNode')
        .mockResolvedValueOnce({ ...treeApprover, threshold: 1, approvers: [{ ...treeChild }] });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...treeApprover, threshold: 1, approvers: [{ ...treeChild }] });
      dataSource.manager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      await service.updateTransactionApprover(treeChild.id, dto, transactionId, user);

      expect(dataSource.manager.update).toHaveBeenNthCalledWith(
        1,
        TransactionApprover,
        treeChild.id,
        {
          listId: null,
          transactionId: transactionId,
        },
      );
      expect(dataSource.manager.softRemove).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should update the threshold of a tree', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        threshold: 1,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(Transaction, expect.anything())
        .mockResolvedValueOnce(transaction);

      await service.updateTransactionApprover(treeApprover.id, dto, transactionId, user);

      expect(dataSource.manager.update).toHaveBeenCalledWith(TransactionApprover, treeApprover.id, {
        threshold: 1,
      });
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        expect.anything(),
        transaction.mirrorNetwork,
      );
    });

    it('should fail on update the threshold of a tree with invalid threshold', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        threshold: 3,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...treeApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...treeApprover });
      dataSource.manager.findOne
        .calledWith(TransactionApprover, expect.anything())
        .mockResolvedValueOnce({ ...treeApprover });

      await expect(
        service.updateTransactionApprover(treeApprover.id, dto, transactionId, user),
      ).rejects.toThrow('Threshold must be less or equal to the number of approvers (2) and not 0');
      expectNotifyNotCalled();
    });

    it('should fail on update the threshold if approver is not a tree', async () => {
      const transactionId = 1;
      const dto: UpdateTransactionApproverDto = {
        threshold: 1,
      };

      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce({ ...basicApprover });
      jest.spyOn(service, 'getRootNodeFromNode').mockResolvedValueOnce({ ...basicApprover });

      await expect(
        service.updateTransactionApprover(basicApprover.id, dto, transactionId, user),
      ).rejects.toThrow('Cannot update threshold, the approver is not a tree');
      expectNotifyNotCalled();
    });
  });

  describe('removeTransactionApprover', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should soft remove approver', async () => {
      jest
        .spyOn(service, 'getTransactionApproverById')
        .mockResolvedValueOnce({ id: 1 } as TransactionApprover);

      await service.removeTransactionApprover(1);

      expect(approversRepo.query).toHaveBeenCalled();
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should fail if approver does not exists', async () => {
      jest.spyOn(service, 'getTransactionApproverById').mockResolvedValueOnce(null);

      await expect(service.removeTransactionApprover(1)).rejects.toThrow(ErrorCodes.ANF);
    });
  });

  describe('approveTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should send transaction approval', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: sdkTransaction.toBytes(),
        mirrorNetwork: 'testnet',
      };

      mockTransaction();

      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockImplementation(jest.fn()),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<TransactionApprover>,
      );

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(verifyTransactionBodyWithoutNodeAccountIdSignature).mockReturnValue(true);

      await service.approveTransaction(dto, transaction.id, user);

      expect(queryBuilder.update).toHaveBeenCalled();
      expect(queryBuilder.set).toHaveBeenCalled();
      expect(queryBuilder.whereInIds).toHaveBeenCalled();
      expect(queryBuilder.execute).toHaveBeenCalled();
      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        transaction.status,
        transaction.mirrorNetwork,
      );
      expect(notifyTransactionAction).toHaveBeenCalledWith(notificationsService);
    });

    it('should throw if user not approver', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        'You are not an approver of this transaction',
      );
      expectNotifyNotCalled();
    });

    it('should throw if user already approver', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
          ...dto,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        ErrorCodes.TAP,
      );
      expectNotifyNotCalled();
    });

    it('should do nothing if user has no keys to approve with', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      jest.mocked(attachKeys).mockImplementationOnce(async (user: User) => {
        user.keys = [];
      });
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(userKeysRequiredToSign).mockResolvedValue([]);

      expect(await service.approveTransaction(dto, transaction.id, { ...user, keys: [] })).toEqual(
        false,
      );
      expectNotifyNotCalled();
    });

    it.skip('should throw if the signature key does not belong to the user', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: 2,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        ErrorCodes.KNRS,
      );
      expectNotifyNotCalled();
    });

    it('should throw if the transaction is not found', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };

      mockTransaction();

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);

      await expect(service.approveTransaction(dto, 1, user)).rejects.toThrow(ErrorCodes.TNF);
      expectNotifyNotCalled();
    });

    it('should throw if the transaction is already executed', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.EXECUTED,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        ErrorCodes.TNRA,
      );
      expectNotifyNotCalled();
    });

    it('should throw if the transaction is canceled', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const transaction = {
        id: 1,
        status: TransactionStatus.CANCELED,
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        ErrorCodes.TNRA,
      );
      expectNotifyNotCalled();
    });

    it('should throw if signature is invalid', async () => {
      const dto: ApproverChoiceDto = {
        userKeyId: user.keys[0].id,
        signature: Buffer.from('0x123'),
        approved: true,
      };
      const sdkTransaction = new AccountCreateTransaction();
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        transactionBytes: sdkTransaction.toBytes(),
      };

      jest.spyOn(service, 'getVerifiedApproversByTransactionId').mockResolvedValueOnce([
        {
          userId: user.id,
          transactionId: 1,
        } as TransactionApprover,
      ]);
      dataSource.manager.findOne.mockResolvedValueOnce(transaction);
      jest.mocked(verifyTransactionBodyWithoutNodeAccountIdSignature).mockReturnValue(false);

      await expect(service.approveTransaction(dto, transaction.id, user)).rejects.toThrow(
        ErrorCodes.SNMP,
      );
      expectNotifyNotCalled();
    });
  });

  describe('getCreatorsTransaction', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return the transaction if user is creator', async () => {
      const transaction = {
        id: 1,
        creatorKey: { userId: user.id },
      };

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      expect(await service.getCreatorsTransaction(1, user)).toEqual(transaction);
    });

    it('should throw if user is not creator', async () => {
      const transaction = {
        id: 1,
        creatorKey: { userId: 2 },
      };

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await expect(service.getCreatorsTransaction(1, user)).rejects.toThrow(
        'Only the creator of the transaction is able to modify it',
      );
    });

    it('should throw if transaction is not found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.getCreatorsTransaction(1, user)).rejects.toThrow(ErrorCodes.TNF);
    });
  });

  describe('getTreeStructure', () => {
    const today = new Date();

    const approver1: TransactionApprover = {
      id: 3,
      transactionId: null,
      userId: 1,
      listId: 2,
      threshold: null,
      approvers: [],
      createdAt: today,
      updatedAt: today,
      deletedAt: null,
    };

    const approver2: TransactionApprover = {
      id: 4,
      transactionId: null,
      userId: 2,
      listId: 2,
      threshold: null,
      approvers: [],
      createdAt: today,
      updatedAt: today,
      deletedAt: null,
    };

    const approver3 = {
      id: 2,
      transactionId: 1,
      userId: null,
      threshold: 2,
      listId: null,
      createdAt: today,
      updatedAt: today,
      deletedAt: null,
    } as TransactionApprover;

    const treeApprover: TransactionApprover = {
      id: 2,
      transactionId: 1,
      userId: null,
      threshold: 2,
      listId: null,
      createdAt: today,
      updatedAt: today,
      deletedAt: null,
      approvers: [
        {
          id: 3,
          transactionId: null,
          userId: 1,
          listId: 2,
          threshold: null,
          approvers: [],
          createdAt: today,
          updatedAt: today,
          deletedAt: null,
        },
        {
          id: 4,
          transactionId: null,
          userId: 2,
          listId: 2,
          threshold: null,
          approvers: [],
          createdAt: today,
          updatedAt: today,
          deletedAt: null,
        },
      ],
    };

    it('should return the tree structure', async () => {
      expect(
        service.getTreeStructure([{ ...approver1 }, { ...approver2 }, { ...approver3 }]),
      ).toEqual([{ ...treeApprover }]);
    });
  });

  describe('isNode', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return true if the approver is node', async () => {
      const transactionId = 1;

      approversRepo.count.mockResolvedValueOnce(1);
      expect(await service.isNode({ userId: 1 } as TransactionApprover, transactionId)).toEqual(
        true,
      );
    });
  });

  describe('emitSyncIndicators', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should emit sync indicators', async () => {
      const transaction = {
        id: 1,
        status: TransactionStatus.WAITING_FOR_EXECUTION,
        mirrorNetwork: 'testnet',
      };

      dataSource.manager.findOne.mockResolvedValueOnce(transaction);

      await service.emitSyncIndicators(transaction.id);

      expect(notifySyncIndicators).toHaveBeenCalledWith(
        notificationsService,
        transaction.id,
        transaction.status,
        transaction.mirrorNetwork,
      );
    });

    it('should do nothing if transaction is not found', async () => {
      dataSource.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.emitSyncIndicators(1));

      expectNotifyNotCalled();
    });
  });
});
