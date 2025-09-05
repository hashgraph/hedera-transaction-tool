import type { HederaSpecialFileId } from './interfaces';

import { proto } from '@hashgraph/proto';
import {
  AccountId,
  ExchangeRates,
  FeeComponents,
  FeeData,
  FeeSchedule,
  FeeSchedules,
  Long,
} from '@hashgraph/sdk';

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
  '*': {
    protoType: proto.AccountID,
  },
};

export function decodeProto(fileId: HederaSpecialFileId, bytes: Uint8Array) {
  if (specialFilesMapping[fileId] === undefined) {
    throw new Error('File ID is not Hedera special file');
  }

  const decoded = specialFilesMapping[fileId].protoType?.decode(bytes);

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
  } else {
    return JSON.stringify(decoded, null, 2);
  }
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
        nodeAddress.nodeId = nodeAddress.nodeId.toString() as any;
      }

      // Node Account ID
      if (nodeAddress.stake) {
        nodeAddress.stake = nodeAddress.stake.toString() as any;
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
      // @ts-ignore mutate the original object
      feeSchedule.expirationTime = feeSchedule?.expirationTime?.seconds.toString();
    }

    feeSchedule.transactionFeeSchedule?.forEach(feeSchedule => {
      // Fee Schedule Hedera Functionality
      if (feeSchedule.hederaFunctionality) {
        // @ts-ignore mutate the original object
        feeSchedule.hederaFunctionality = feeSchedule.hederaFunctionality?.toString();
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
      // @ts-ignore mutate the original object
      feeData.feeDataType = feeData.feeDataType.toString();
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
    // @ts-ignore mutate the original object
    feeComponent.min = feeComponent.min?.toString();
    // @ts-ignore mutate the original object
    feeComponent.max = feeComponent.max?.toString();
    // @ts-ignore mutate the original object
    feeComponent.constant = feeComponent.constant?.toString();
    // @ts-ignore mutate the original object
    feeComponent.transactionBandwidthByte = feeComponent.transactionBandwidthByte?.toString();
    // @ts-ignore mutate the original object
    feeComponent.transactionVerification = feeComponent.transactionVerification?.toString();
    // @ts-ignore mutate the original object
    feeComponent.transactionRamByteHour = feeComponent.transactionRamByteHour?.toString();
    // @ts-ignore mutate the original object
    feeComponent.transactionStorageByteHour = feeComponent.transactionStorageByteHour?.toString();
    // @ts-ignore mutate the original object
    feeComponent.contractTransactionGas = feeComponent.contractTransactionGas?.toString();
    // @ts-ignore mutate the original object
    feeComponent.transferVolumeHbar = feeComponent.transferVolumeHbar?.toString();
    // @ts-ignore mutate the original object
    feeComponent.responseMemoryByte = feeComponent.responseMemoryByte?.toString();
    // @ts-ignore mutate the original object
    feeComponent.responseDiskByte = feeComponent.responseDiskByte?.toString();

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
  // const nameValues = servicesConfigurationList.nameValue?.map(
  //   nv => `${nv.name}=${nv.value}${nv.data && nv.data.length > 0 ? ` data=${nv.data}` : ''}`,
  // );
  const nameValues = servicesConfigurationList.nameValue?.map(nv => `${nv.name}=${nv.value}`);
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
      if (throttleGroup.milliOpsPerSec) {
        throttleGroup.milliOpsPerSec = throttleGroup.milliOpsPerSec.toString() as any;
      }
    });

    // Burst Period in ms
    if (throttleBucket.burstPeriodMs) {
      throttleBucket.burstPeriodMs = throttleBucket.burstPeriodMs.toString() as any;
    }
  });

  return JSON.stringify(throttleDefinitions, null, 2);
}

export function encodeHederaSpecialFile(content: Uint8Array, fileId: HederaSpecialFileId) {
  switch (fileId) {
    case '0.0.101':
    case '0.0.102':
      return encodeNodeAddressBook(content);
    case '0.0.111':
      return encodeCurrentAndNextFeeSchedules(content);
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
  const nodeAddressBook = parseBytesToJson<proto.INodeAddressBook>(content);

  if (nodeAddressBook.nodeAddress) {
    nodeAddressBook.nodeAddress.forEach(nodeAddress => {
      // Node Id
      if ((nodeAddress.nodeId as any) === '0') {
        nodeAddress.nodeId = undefined;
      } else if (nodeAddress.nodeId) {
        nodeAddress.nodeId = Long.fromString(nodeAddress.nodeId.toString(), false);
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
  const exchangeRateSet = parseBytesToJson<proto.IExchangeRateSet>(content);

  const protoExchangeRateSet = proto.ExchangeRateSet.create(exchangeRateSet);

  if (protoExchangeRateSet.currentRate?.expirationTime) {
    protoExchangeRateSet.currentRate.expirationTime = proto.TimestampSeconds.create({
      seconds: protoExchangeRateSet.currentRate.expirationTime.seconds,
    });
  }

  if (protoExchangeRateSet.nextRate?.expirationTime) {
    protoExchangeRateSet.nextRate.expirationTime = proto.TimestampSeconds.create({
      seconds: protoExchangeRateSet.nextRate.expirationTime.seconds,
    });
  }

  const protobuffEncodedBuffer = proto.ExchangeRateSet.encode(protoExchangeRateSet).finish();

  return protobuffEncodedBuffer;
}

function encodeServicesConfigurationList(content: Uint8Array) {
  let stringContent = Buffer.from(content).toString();
  stringContent = stringContent.slice(1, stringContent.length - 1);

  const parsed = stringContent
    .split(/\\n/)
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
  const throttleDefinitions = parseBytesToJson<proto.IThrottleDefinitions>(content);

  throttleDefinitions.throttleBuckets?.forEach(throttleBucket => {
    // Throttle Groups
    throttleBucket.throttleGroups?.forEach(throttleGroup => {
      // Operations
      if (throttleGroup.operations) {
        throttleGroup.operations = throttleGroup.operations.map(
          operation => proto.HederaFunctionality[operation],
        ) as any;
      }

      if (throttleGroup.milliOpsPerSec) {
        // Operations Per Second in ms
        throttleGroup.milliOpsPerSec = Long.fromString(
          throttleGroup.milliOpsPerSec.toString(),
          false,
        );
      }
    });

    // @ts-ignore unused property
    delete throttleBucket.burstPeriod;

    // Burst Period in ms
    if (throttleBucket.burstPeriodMs) {
      throttleBucket.burstPeriodMs = Long.fromString(
        throttleBucket.burstPeriodMs.toString(),
        false,
      );
    }
  });

  const protoThrottleDefinitions = proto.ThrottleDefinitions.create(throttleDefinitions);

  const protobuffEncodedBuffer =
    proto.ThrottleDefinitions.encode(protoThrottleDefinitions).finish();

  return protobuffEncodedBuffer;
}

function encodeCurrentAndNextFeeSchedules(content: Uint8Array) {
  let currentAndNextFeeSchedule = parseBytesToJson<proto.ICurrentAndNextFeeSchedule>(content);

  try {
    //@ts-expect-error Strange behaviour of JSON.parse
    currentAndNextFeeSchedule = JSON.parse(currentAndNextFeeSchedule);
  } catch {
    // Do nothing
  }

  if (currentAndNextFeeSchedule.currentFeeSchedule) {
    currentAndNextFeeSchedule.currentFeeSchedule = formatFeeSchedule(
      currentAndNextFeeSchedule.currentFeeSchedule,
    );
  }

  if (currentAndNextFeeSchedule.nextFeeSchedule) {
    currentAndNextFeeSchedule.nextFeeSchedule = formatFeeSchedule(
      currentAndNextFeeSchedule.nextFeeSchedule,
    );
  }

  const protoExchangeRateSet = proto.CurrentAndNextFeeSchedule.create(currentAndNextFeeSchedule);

  const protobuffEncodedBuffer =
    proto.CurrentAndNextFeeSchedule.encode(protoExchangeRateSet).finish();

  return protobuffEncodedBuffer;

  function formatFeeSchedule(feeSchedule: proto.IFeeSchedule) {
    feeSchedule.transactionFeeSchedule?.forEach(txfeeSchedule => {
      if (txfeeSchedule.feeData) {
        txfeeSchedule.feeData = formatFeeData(txfeeSchedule.feeData);
      }

      if (txfeeSchedule.fees) {
        txfeeSchedule.fees = txfeeSchedule.fees.map(feeData => formatFeeData(feeData));
      }

      if (txfeeSchedule.hederaFunctionality) {
        txfeeSchedule.hederaFunctionality = proto.HederaFunctionality[
          txfeeSchedule.hederaFunctionality
        ] as any;
      }
    });

    if (feeSchedule.expiryTime) {
      feeSchedule.expiryTime = proto.TimestampSeconds.create({
        seconds: feeSchedule.expiryTime as any,
      });
    }

    return feeSchedule;
  }

  function formatFeeData(feeData: proto.IFeeData) {
    if (feeData.networkdata) {
      feeData.networkdata = formatFeeComponents(feeData.networkdata);
    }

    if (feeData.nodedata) {
      feeData.nodedata = formatFeeComponents(feeData.nodedata);
    }

    if (feeData.servicedata) {
      feeData.servicedata = formatFeeComponents(feeData.servicedata);
    }

    if (feeData.subType) {
      feeData.subType = proto.SubType[feeData.subType] as any;
    }
    return feeData;
  }

  function formatFeeComponents(feeComponents: proto.IFeeComponents) {
    if (feeComponents.min) {
      feeComponents.min = Long.fromString(feeComponents.min.toString(), false);
    }
    if (feeComponents.max) {
      feeComponents.max = Long.fromString(feeComponents.max.toString(), false);
    }
    if (feeComponents.constant) {
      feeComponents.constant = Long.fromString(feeComponents.constant.toString(), false);
    }
    if (feeComponents.bpt) {
      feeComponents.bpt = Long.fromString(feeComponents.bpt.toString(), false);
    }
    if (feeComponents.vpt) {
      feeComponents.vpt = Long.fromString(feeComponents.vpt.toString(), false);
    }
    if (feeComponents.rbh) {
      feeComponents.rbh = Long.fromString(feeComponents.rbh.toString(), false);
    }
    if (feeComponents.sbh) {
      feeComponents.sbh = Long.fromString(feeComponents.sbh.toString(), false);
    }
    if (feeComponents.gas) {
      feeComponents.gas = Long.fromString(feeComponents.gas.toString(), false);
    }
    if (feeComponents.tv) {
      feeComponents.tv = Long.fromString(feeComponents.tv.toString(), false);
    }
    if (feeComponents.bpr) {
      feeComponents.bpr = Long.fromString(feeComponents.bpr.toString(), false);
    }
    if (feeComponents.sbpr) {
      feeComponents.sbpr = Long.fromString(feeComponents.sbpr.toString(), false);
    }

    return feeComponents;
  }
}

/* Strange behaviour of JSON.parse requires such function */
function parseBytesToJson<T>(bytes: Uint8Array): T {
  let bytesString = JSON.parse(Buffer.from(bytes).toString());

  try {
    bytesString = JSON.parse(bytesString);
    return bytesString;
  } catch {
    return bytesString;
  }
}
