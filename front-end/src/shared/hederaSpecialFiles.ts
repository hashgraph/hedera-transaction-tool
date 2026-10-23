import type { HederaSpecialFileId } from './interfaces';

import { proto } from '@hiero-ledger/proto';
import {
  AccountId,
  ExchangeRates,
  type FeeComponents,
  type FeeData,
  type FeeSchedule,
  FeeSchedules,
  Long,
} from '@hiero-ledger/sdk';

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

  const protoType = specialFilesMapping[fileId].protoType;
  const decoded = protoType.decode(bytes);

  // We a round-trip Protobuf decode/re-encode on the file content. If we do not get the
  // same result, we add a warning to the contents to warn the user because if typically means
  // that there are additional or duplicate fields in the Protobuf.
  // It is in theory possible that this also fails due to a different field order in
  // encoding -- we would then get a false positive.
  const hasHiddenData = decoded !== undefined && !reEncodesTo(protoType, decoded, bytes);

  let formatted: string;
  if (decoded instanceof proto.NodeAddressBook) {
    formatted = stringifyNodeAddressBook(decoded);
  } else if (decoded instanceof proto.CurrentAndNextFeeSchedule) {
    formatted = stringifyCurrentAndNextFeeSchedule(decoded);
  } else if (decoded instanceof proto.ExchangeRateSet) {
    formatted = stringifyExchangeRetSet(decoded);
  } else if (decoded instanceof proto.ServicesConfigurationList) {
    formatted = stringifyServicesConfigurationList(decoded);
  } else if (decoded instanceof proto.ThrottleDefinitions) {
    formatted = stringifyThrottleDefinitions(decoded);
  } else {
    formatted = JSON.stringify(decoded, null, 2);
  }

  // Include a warning notice when the decoded view does not account for every byte of the contents.
  // And display the original content bytes too.
  const review = {
    ...JSON.parse(formatted),
    ...(hasHiddenData
      ? {
          warning:
            'Contents include data not shown above (unknown or duplicate fields, or non-canonical encoding). The exact bytes are listed below.',
        }
      : {}),
    originalBytesHex: Buffer.from(bytes).toString('hex'),
  };

  return escapeReviewText(JSON.stringify(review, null, 2));
}

/** Check whether re-encoding the decoded Protobuf reproduces the original bytes, i.e. nothing was dropped. */
function reEncodesTo(
  protoType: { encode(message: any): { finish(): Uint8Array } },
  decoded: unknown,
  bytes: Uint8Array,
) {
  return Buffer.from(protoType.encode(decoded).finish()).equals(Buffer.from(bytes));
}

/** Keep invisible formatting and non-ASCII characters visible in review text. */
export function escapeReviewText(text: string): string {
  return text.replace(
    /[\x00-\x08\x0B-\x1F\x7F-\uFFFF]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function stringifyNodeAddressBook(nodeAddressBook: proto.INodeAddressBook) {
  const nodeAddressBookFormatted = nodeAddressBook.nodeAddress;

  nodeAddressBookFormatted?.forEach(nodeAddress => {
    // Service Endpoint
    nodeAddress.serviceEndpoint?.forEach(e => {
      if (e.ipAddressV4) {
        e.ipAddressV4 = e.ipAddressV4.join('.') as any;
      }
    });

    // Node Cert Hash
    nodeAddress.nodeCertHash =
      `0x${Buffer.from(nodeAddress.nodeCertHash ?? []).toString('hex')}` as any;

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
  return JSON.stringify(
    {
      nameValue:
        servicesConfigurationList.nameValue?.map(setting => ({
          name: setting.name ?? '',
          value: setting.value ?? '',
          data: Buffer.from(setting.data ?? []).toString('base64'),
        })) ?? [],
    },
    null,
    2,
  );
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
        const hash = nodeAddress.nodeCertHash as string;
        nodeAddress.nodeCertHash = new Uint8Array(
          hash.startsWith('0x') ? Buffer.from(hash.slice(2), 'hex') : Buffer.from(hash, 'utf-8'),
        );
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
  const json = parseBytesToJson<
    { nameValue?: Array<{ name: string; value: string; data?: string }> } | string
  >(content);
  if (typeof json === 'object' && json !== null) {
    return proto.ServicesConfigurationList.encode(
      proto.ServicesConfigurationList.create({
        nameValue: json.nameValue?.map(setting => ({
          name: setting.name,
          value: setting.value,
          data: Buffer.from(setting.data ?? '', 'base64'),
        })),
      }),
    ).finish();
  }
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
