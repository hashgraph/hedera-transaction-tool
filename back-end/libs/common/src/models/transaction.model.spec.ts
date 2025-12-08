import { KeyList, PrivateKey, Key } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction.model';
import { mockDeep } from 'jest-mock-extended';
import {
  AccountInfoParsed,
  MirrorNodeService,
  NodeInfoParsed,
  parseAccountInfo,
  parseNodeInfo,
} from '@app/common';

jest.mock('@app/common/utils');

describe('TransactionBaseModel.computeSignatureKey', () => {
  let mirrorNetwork: string;
  const mirrorNodeService = mockDeep<MirrorNodeService>();

  beforeEach(() => {
    mirrorNetwork = 'testnet';
    jest.resetAllMocks();
  });

  class TestTransactionModel extends TransactionBaseModel<any> {
    signingAccounts = new Set<string>();
    receiverAccounts = new Set<string>();
    newKeys: Key[] = [];
    nodeId: number | null = null;

    getSigningAccounts() { return this.signingAccounts; }
    getReceiverAccounts() { return this.receiverAccounts; }
    getNewKeys() { return this.newKeys; }
    getNodeId() { return this.nodeId; }
  }

  it('returns only newKeys if no accounts or nodeId', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.newKeys = [pk.publicKey];

    const expectedKeyList = new KeyList([pk.publicKey]);

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result._toProtobufKey()).toEqual(expectedKeyList._toProtobufKey());
  });

  it('adds account keys from getSigningAccounts', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.signingAccounts = new Set(['0.0.123']);

    const expectedKeyList = new KeyList([pk.publicKey]);

    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: pk.publicKey,
    } as unknown as AccountInfoParsed);

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result._toProtobufKey()).toEqual(expectedKeyList._toProtobufKey());
  });

  it('adds receiver account keys if receiverSignatureRequired', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.receiverAccounts = new Set(['0.0.456']);

    const expectedKeyList = new KeyList([pk.publicKey]);

    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: pk.publicKey,
      receiverSignatureRequired: true,
    } as unknown as AccountInfoParsed);

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result._toProtobufKey()).toEqual(expectedKeyList._toProtobufKey());
  });

  it('does not add receiver account key if receiverSignatureRequired is false', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.receiverAccounts = new Set(['0.0.456']);

    const expectedKeyList = new KeyList([]);

    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: pk.publicKey,
      receiverSignatureRequired: false,
    } as unknown as AccountInfoParsed);

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result._toProtobufKey()).toEqual(expectedKeyList._toProtobufKey());
  });

  it('adds node admin key if nodeId is set', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.nodeId = 2;

    const expectedKeyList = new KeyList([pk.publicKey]);

    jest.mocked(parseNodeInfo).mockReturnValueOnce({
      admin_key: pk.publicKey,
    } as unknown as NodeInfoParsed);

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result._toProtobufKey()).toEqual(expectedKeyList._toProtobufKey());
  });

  it('handles errors gracefully and continues', async () => {
    const pk = PrivateKey.generateED25519();
    const model = new TestTransactionModel({});
    model.signingAccounts = new Set(['0.0.123']);
    mirrorNodeService.getAccountInfo.mockRejectedValueOnce(new Error('fail'));

    const result = await model.computeSignatureKey(mirrorNodeService, mirrorNetwork);
    expect(result.toArray()).toEqual([]);
  });
});