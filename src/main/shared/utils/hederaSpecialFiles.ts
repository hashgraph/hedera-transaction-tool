import { proto } from '@hashgraph/proto';
import { AccountId, ExchangeRates } from '@hashgraph/sdk';
import Long from 'long';

export type HederaSpecialFileId =
  | '0.0.101'
  | '0.0.102'
  | '0.0.111'
  | '0.0.112'
  | '0.0.121'
  | '0.0.122'
  | '0.0.123';

export function isHederaSpecialFileId(value: any): value is HederaSpecialFileId {
  const validValues: HederaSpecialFileId[] = [
    '0.0.101',
    '0.0.102',
    '0.0.111',
    '0.0.112',
    '0.0.121',
    '0.0.122',
    '0.0.123',
  ];

  return validValues.includes(value);
}

const specialFilesMapping = {
  '0.0.101': {
    protoType: proto.NodeAddressBook, // addressBook.json
  },
  '0.0.102': {
    protoType: proto.NodeAddressBook, //nodeDetails.json
  },
  '0.0.111': {
    protoType: proto.CurrentAndNextFeeSchedule, //feeSchedules.json
  },
  '0.0.112': {
    protoType: proto.ExchangeRateSet, //exchangeRates.json
  },
  '0.0.121': {
    protoType: proto.ServicesConfigurationList, //application.properties
  },
  '0.0.122': {
    protoType: proto.ServicesConfigurationList, //api-permission.properties
  },
  '0.0.123': {
    protoType: proto.ThrottleDefinitions, //throttles.json
  },
};

export function decodeProto(fileId: HederaSpecialFileId, response: any) {
  if (specialFilesMapping[fileId].protoType === null) {
    throw new Error('File ID is not Hedera special file');
  }

  const decoded = specialFilesMapping[fileId].protoType?.decode(response);

  if (decoded instanceof proto.NodeAddressBook) {
    return stringifyNodeAddressBook(decoded);
  } else if (decoded instanceof proto.ExchangeRateSet) {
    return stringifyExchangeRetSet(decoded);
  }

  return JSON.stringify(decoded, null, 2);
}

function stringifyNodeAddressBook(nodeAddressBook: proto.INodeAddressBook) {
  const nodeAddressBookFormatted = nodeAddressBook.nodeAddress;

  nodeAddressBookFormatted?.forEach(nodeAddress => {
    if (nodeAddress.nodeCertHash) {
      // Service Endpoint
      nodeAddress.serviceEndpoint?.forEach(e => {
        if (e.ipAddressV4) {
          e.ipAddressV4 = e.ipAddressV4.join('.') as any;
        }
      });

      // Node Cert Hash
      nodeAddress.nodeCertHash = Buffer.from(nodeAddress.nodeCertHash).toString('utf-8') as any;

      // Node Account ID
      if (nodeAddress.nodeAccountId) {
        nodeAddress.nodeAccountId = AccountId._fromProtobuf(
          nodeAddress.nodeAccountId,
        ).toString() as any;
      }

      // Node Account ID
      if (nodeAddress.nodeId) {
        nodeAddress.nodeId = nodeAddress.nodeId.toString();
      }

      // Node Account ID
      if (nodeAddress.stake) {
        nodeAddress.stake = nodeAddress.stake.toString();
      }
    }
  });

  return JSON.stringify(nodeAddressBookFormatted, null, 2);
}

function stringifyExchangeRetSet(exchangeRateSet: proto.IExchangeRateSet) {
  const exchangeRates = ExchangeRates._fromProtobuf(exchangeRateSet);
  return JSON.stringify(exchangeRates, null, 2);
}

export function encodeHederaSpecialFile(content: Uint8Array, fileId: HederaSpecialFileId) {
  switch (fileId) {
    case '0.0.101':
    case '0.0.102':
      return encodeNodeAddressBook(content);
    case '0.0.111':
    case '0.0.112':
    case '0.0.121':
    case '0.0.122':
    case '0.0.123':
      break;
  }
}

function encodeNodeAddressBook(content: Uint8Array) {
  const nodeAddresses: proto.INodeAddress[] = JSON.parse(Buffer.from(content).toString());

  nodeAddresses.forEach(nodeAddress => {
    // Node Id
    nodeAddress.nodeId = nodeAddress.nodeId ? new Long(nodeAddress.nodeId, 0, true) : null;

    // Acccount Id
    nodeAddress.nodeAccountId = nodeAddress.nodeAccountId
      ? AccountId.fromString(nodeAddress.nodeAccountId as string)._toProtobuf()
      : null;

    // Node Cert Hash
    if (typeof nodeAddress.nodeCertHash === 'string') {
      nodeAddress.nodeCertHash = new Uint8Array(Buffer.from(nodeAddress.nodeCertHash, 'utf-8'));
    }

    // Service Endpoints
    nodeAddress.serviceEndpoint?.forEach(endpoint => {
      if (typeof endpoint.ipAddressV4 === 'string') {
        const ipAddressV4: string = endpoint.ipAddressV4;
        endpoint.ipAddressV4 = Uint8Array.from(ipAddressV4.split('.').map(b => Number(b)));
        endpoint.port = endpoint.port ? Number(endpoint.port) : null;
      }
    });
  });

  const nodeAddressBook: proto.INodeAddressBook = {
    nodeAddress: nodeAddresses,
  };

  const protoNodeAddressBook = proto.NodeAddressBook.create(nodeAddressBook);
  const encoded = proto.NodeAddressBook.encode(protoNodeAddressBook).finish();
  console.log(proto.NodeAddressBook.decode(encoded));

  return encoded;
}
