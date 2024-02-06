import { proto } from '@hashgraph/proto';
import {
  AccountId,
  ExchangeRates,
  FeeComponents,
  FeeData,
  FeeSchedule,
  FeeSchedules,
} from '@hashgraph/sdk';
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
  if (specialFilesMapping[fileId] === undefined) {
    throw new Error('File ID is not Hedera special file');
  }

  const decoded = specialFilesMapping[fileId].protoType?.decode(response);

  if (decoded instanceof proto.NodeAddressBook) {
    return stringifyNodeAddressBook(decoded);
  } else if (decoded instanceof proto.CurrentAndNextFeeSchedule) {
    return stringifyCurrentAndNextFeeSchedule(decoded);
  } else if (decoded instanceof proto.ExchangeRateSet) {
    return stringifyExchangeRetSet(decoded);
  } else if (decoded instanceof proto.ServicesConfigurationList) {
    return stringifyServicesConfigurationList(decoded);
  } else if (decoded instanceof proto.ThrottleDefinitions) {
    return stringifyThrottleDefinitions(decoded);
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

  return JSON.stringify({ nodeAddress: nodeAddressBookFormatted }, null, 2);
}

function stringifyCurrentAndNextFeeSchedule(
  currentAndNextFeeSchedule: proto.ICurrentAndNextFeeSchedule,
) {
  const feeSchedules = FeeSchedules._fromProtobuf(currentAndNextFeeSchedule);

  if (feeSchedules.current) {
    feeSchedules.current = stringifyFeeSchedule(feeSchedules.current);
  }

  if (feeSchedules.next) {
    feeSchedules.next = stringifyFeeSchedule(feeSchedules.next);
  }

  return JSON.stringify(feeSchedules, null, 2);

  function stringifyFeeSchedule(feeSchedule: FeeSchedule) {
    // Expiration Time
    if (feeSchedule.expirationTime) {
      feeSchedule.expirationTime = feeSchedule?.expirationTime?.seconds.toString() as any;
    }

    feeSchedule.transactionFeeSchedule?.forEach(feeSchedule => {
      // Fee Schedule Hedera Functionality
      if (feeSchedule.hederaFunctionality) {
        feeSchedule.hederaFunctionality = feeSchedule.hederaFunctionality?.toString() as any;
      }

      // Fee Schedule Fee Data
      if (feeSchedule.feeData) {
        feeSchedule.feeData = stringifyFeeData(feeSchedule.feeData);
      }

      // Fee Schedule Fees
      if (feeSchedule.fees) {
        feeSchedule.fees = feeSchedule.fees.map(fee => stringifyFeeData(fee));
      }
    });

    return feeSchedule;
  }

  function stringifyFeeData(feeData: FeeData) {
    // Fee Data Type
    if (feeData.feeDataType) {
      feeData.feeDataType = feeData.feeDataType.toString() as any;
    }

    // Fee Node Data
    if (feeData.nodedata) {
      feeData.nodedata = stringifyFeeComponent(feeData.nodedata);
    }

    // Fee Network Data
    if (feeData.networkdata) {
      feeData.networkdata = stringifyFeeComponent(feeData.networkdata);
    }

    // Fee Service Data
    if (feeData.servicedata) {
      feeData.servicedata = stringifyFeeComponent(feeData.servicedata);
    }

    return feeData;
  }

  function stringifyFeeComponent(feeComponent: FeeComponents) {
    feeComponent.min = feeComponent.min.toString();
    feeComponent.max = feeComponent.max.toString();
    feeComponent.constant = feeComponent.constant.toString();
    feeComponent.transactionBandwidthByte = feeComponent.transactionBandwidthByte.toString();
    feeComponent.transactionVerification = feeComponent.transactionVerification.toString();
    feeComponent.transactionRamByteHour = feeComponent.transactionRamByteHour.toString();
    feeComponent.transactionStorageByteHour = feeComponent.transactionStorageByteHour.toString();
    feeComponent.contractTransactionGas = feeComponent.contractTransactionGas.toString();
    feeComponent.transferVolumeHbar = feeComponent.transferVolumeHbar.toString();
    feeComponent.responseMemoryByte = feeComponent.responseMemoryByte.toString();
    feeComponent.responseDiskByte = feeComponent.responseDiskByte.toString();

    return feeComponent;
  }
}

function stringifyExchangeRetSet(exchangeRateSet: proto.IExchangeRateSet) {
  const exchangeRates = ExchangeRates._fromProtobuf(exchangeRateSet);
  return JSON.stringify(exchangeRates, null, 2);
}

function stringifyServicesConfigurationList(
  servicesConfigurationList: proto.IServicesConfigurationList,
) {
  const nameValues = servicesConfigurationList.nameValue?.map(
    nv => `${nv.name}=${nv.value}${nv.data && nv.data.length > 0 ? ` data=${nv.data}` : ''}`,
  );
  return nameValues?.join('\n');
}

function stringifyThrottleDefinitions(throttleDefinitions: proto.IThrottleDefinitions) {
  // Throttle Bucket
  throttleDefinitions.throttleBuckets?.forEach(throttleBucket => {
    // Throttle Groups
    throttleBucket.throttleGroups?.forEach(throttleGroup => {
      // Operations
      if (throttleGroup.operations) {
        throttleGroup.operations = throttleGroup.operations.map(
          operation => proto.HederaFunctionality[operation],
        ) as any;
      }

      // Operations Per Second in ms
      throttleGroup.milliOpsPerSec = throttleGroup.milliOpsPerSec.toString();
    });

    // Burst Period in ms
    throttleBucket.burstPeriodMs = throttleBucket.burstPeriodMs.toString();
  });

  return JSON.stringify(throttleDefinitions, null, 2);
}

export function encodeHederaSpecialFile(content: Uint8Array, fileId: HederaSpecialFileId) {
  switch (fileId) {
    case '0.0.101':
    case '0.0.102':
      return encodeNodeAddressBook(content);
    case '0.0.111':
    case '0.0.112':
      return encodeExchangeRates(content);
    case '0.0.121':
    case '0.0.122':
      return encodeServicesConfigurationList(content);
    case '0.0.123':
      return encodeThrottleDefinitions(content);
    default:
      throw new Error('File is not special');
  }
}

function encodeNodeAddressBook(content: Uint8Array) {
  const nodeAddressBook: proto.INodeAddressBook = JSON.parse(Buffer.from(content).toString());

  if (nodeAddressBook.nodeAddress) {
    nodeAddressBook.nodeAddress.forEach(nodeAddress => {
      // Node Id
      if (nodeAddress.nodeId === '0') {
        nodeAddress.nodeId = undefined;
      } else if (nodeAddress.nodeId) {
        nodeAddress.nodeId = new Long(nodeAddress.nodeId, 0, true);
      }

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
  }

  const protoNodeAddressBook = proto.NodeAddressBook.create(nodeAddressBook);
  const encoded = proto.NodeAddressBook.encode(protoNodeAddressBook).finish();

  return encoded;
}

function encodeExchangeRates(content: Uint8Array) {
  const exchangeRateSet: proto.IExchangeRateSet = JSON.parse(Buffer.from(content).toString());

  const protoExchangeRateSet = proto.ExchangeRateSet.create(exchangeRateSet);

  const protobuffEncodedBuffer = proto.ExchangeRateSet.encode(protoExchangeRateSet).finish();

  return protobuffEncodedBuffer;
}

function encodeServicesConfigurationList(content: Uint8Array) {
  const parsed = Buffer.from(content)
    .toString()
    .split('\n')
    .filter(l => l)
    .map(line => {
      const args = line.split('=');
      const setting = proto.Setting.create({
        name: args[0],
        value: `${args[1]}`,
      });
      return setting;
    });

  const properties = proto.ServicesConfigurationList.create({
    nameValue: parsed,
  });

  const protobuffEncodedBuffer = proto.ServicesConfigurationList.encode(properties).finish();

  return protobuffEncodedBuffer;
}

function encodeThrottleDefinitions(content: Uint8Array) {
  const throttleDefinitions: proto.IThrottleDefinitions = JSON.parse(
    Buffer.from(content).toString(),
  );

  throttleDefinitions.throttleBuckets?.forEach(throttleBucket => {
    // Throttle Groups
    throttleBucket.throttleGroups?.forEach(throttleGroup => {
      // Operations
      if (throttleGroup.operations) {
        throttleGroup.operations = throttleGroup.operations.map(
          operation => proto.HederaFunctionality[operation],
        ) as any;
      }

      // Operations Per Second in ms
      throttleGroup.milliOpsPerSec = new Long(throttleGroup.milliOpsPerSec, 0, true);
    });

    // @ts-ignore unused property
    delete throttleBucket.burstPeriod;

    // Burst Period in ms
    if (throttleBucket.burstPeriodMs) {
      throttleBucket.burstPeriodMs = new Long(throttleBucket.burstPeriodMs, 0, true);
    }
  });

  const protoThrottleDefinitions = proto.ThrottleDefinitions.create(throttleDefinitions);

  const protobuffEncodedBuffer =
    proto.ThrottleDefinitions.encode(protoThrottleDefinitions).finish();

  console.log(JSON.stringify(proto.ThrottleDefinitions.decode(protobuffEncodedBuffer)));

  return protobuffEncodedBuffer;
}
