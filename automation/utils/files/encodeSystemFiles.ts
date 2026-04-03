import * as fs from 'node:fs';
import { proto } from '@hashgraph/proto';
import Long from 'long';
import { AccountId } from '@hashgraph/sdk';

/**
 * Reads the exchange rates JSON file, encodes it into binary, and writes to a .bin file.
 */
export function encodeExchangeRates(jsonFilePath: string, outputFilePath: string) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  const data = JSON.parse(jsonContent);
  const formattedData = formatExchangeRateSet(data);
  const protoMessage = proto.ExchangeRateSet.create(formattedData);
  const encodedBytes = proto.ExchangeRateSet.encode(protoMessage).finish();
  fs.writeFileSync(outputFilePath, Buffer.from(encodedBytes));
  console.log(`Exchange rates have been encoded and written to ${outputFilePath}`);
}

/**
 * Formats the exchange rate data to match the protobuf structure.
 */
function formatExchangeRateSet(data: any) {
  console.log(data);
  if (data.currentRate) {
    data.currentRate = formatExchangeRate(data.currentRate);
  }
  if (data.nextRate) {
    data.nextRate = formatExchangeRate(data.nextRate);
  }
  return data;
}

/**
 * Formats individual exchange rate entries.
 */
function formatExchangeRate(rate: any) {
  if (rate.expirationTime) {
    console.log(rate.expirationTime);
    rate.expirationTime = proto.TimestampSeconds.create({
      seconds: Long.fromValue(rate.expirationTime.seconds),
    } as proto.ITimestampSeconds);
  }
  if (rate.hbarEquiv) {
    rate.hbarEquiv = Long.fromValue(rate.hbarEquiv);
  }
  if (rate.centEquiv) {
    rate.centEquiv = Long.fromValue(rate.centEquiv);
  }
  return rate;
}

/**
 * Encodes the fee schedule JSON into a binary file.
 */
export function encodeFeeSchedule(jsonFilePath: string, outputFilePath: string) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file` + (error instanceof Error ? `: ${error.message}` : ''),
    );
  }
  const formattedData = formatCurrentAndNextFeeSchedule(data);
  const protoMessage = proto.CurrentAndNextFeeSchedule.create(formattedData);
  const encodedBytes = proto.CurrentAndNextFeeSchedule.encode(protoMessage).finish();
  fs.writeFileSync(outputFilePath, Buffer.from(encodedBytes));
  console.log(`Fee schedule has been encoded and written to ${outputFilePath}`);
}

/**
 * Formats the entire CurrentAndNextFeeSchedule object.
 */
function formatCurrentAndNextFeeSchedule(data: any) {
  if (data.currentFeeSchedule) {
    data.currentFeeSchedule = formatFeeSchedule(data.currentFeeSchedule);
  }
  if (data.nextFeeSchedule) {
    data.nextFeeSchedule = formatFeeSchedule(data.nextFeeSchedule);
  }
  return data;
}

/**
 * Formats a FeeSchedule object.
 */
function formatFeeSchedule(feeSchedule: any) {
  if (feeSchedule.expiryTime) {
    feeSchedule.expiryTime = proto.TimestampSeconds.create({
      seconds: Long.fromString(feeSchedule.expiryTime.toString(), true),
    } as proto.ITimestampSeconds);
  }
  if (feeSchedule.transactionFeeSchedule) {
    feeSchedule.transactionFeeSchedule = feeSchedule.transactionFeeSchedule.map(
      formatTransactionFeeSchedule,
    );
  }
  return feeSchedule;
}

/**
 * Formats a TransactionFeeSchedule object.
 */
function formatTransactionFeeSchedule(txFeeSchedule: any) {
  if (txFeeSchedule.hederaFunctionality) {
    txFeeSchedule.hederaFunctionality =
      proto.HederaFunctionality[txFeeSchedule.hederaFunctionality];
  }
  if (txFeeSchedule.fees) {
    txFeeSchedule.fees = txFeeSchedule.fees.map(formatFeeData);
  }
  if (txFeeSchedule.feeData) {
    txFeeSchedule.feeData = formatFeeData(txFeeSchedule.feeData);
  }
  return txFeeSchedule;
}

/**
 * Formats a FeeData object.
 */
function formatFeeData(feeData: any) {
  if (feeData.nodedata) {
    feeData.nodedata = formatFeeComponents(feeData.nodedata);
  }
  if (feeData.networkdata) {
    feeData.networkdata = formatFeeComponents(feeData.networkdata);
  }
  if (feeData.servicedata) {
    feeData.servicedata = formatFeeComponents(feeData.servicedata);
  }
  if (feeData.subType) {
    feeData.subType = proto.SubType[feeData.subType];
  }
  return feeData;
}

/**
 * Formats a FeeComponents object.
 */
function formatFeeComponents(feeComponents: any) {
  for (const key in feeComponents) {
    if (feeComponents.hasOwnProperty(key)) {
      const value = feeComponents[key];
      if (typeof value === 'string' || typeof value === 'number') {
        feeComponents[key] = Long.fromString(value.toString(), true);
      }
    }
  }
  return feeComponents;
}

/**
 * Encodes the node address book JSON into a binary file.
 */
export function encodeNodeAddressBook(jsonFilePath: string, outputFilePath: string) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file` + (error instanceof Error ? `: ${error.message}` : ''),
    );
  }
  const formattedData = formatNodeAddressBook(data);
  const protoMessage = proto.NodeAddressBook.create(formattedData);
  const encodedBytes = proto.NodeAddressBook.encode(protoMessage).finish();
  fs.writeFileSync(outputFilePath, Buffer.from(encodedBytes));
  console.log(`Node address book has been encoded and written to ${outputFilePath}`);
}

/**
 * Formats the NodeAddressBook object.
 */
function formatNodeAddressBook(nodeAddressBook: any) {
  if (nodeAddressBook.nodeAddress && Array.isArray(nodeAddressBook.nodeAddress)) {
    nodeAddressBook.nodeAddress.forEach((nodeAddress: any) => {
      // Node Id
      if (nodeAddress.nodeId === '0' || nodeAddress.nodeId === 0) {
        nodeAddress.nodeId = undefined;
      } else if (nodeAddress.nodeId) {
        nodeAddress.nodeId = Long.fromString(nodeAddress.nodeId.toString(), false);
      }

      // Node Account ID
      if (nodeAddress.nodeAccountId) {
        nodeAddress.nodeAccountId = AccountId.fromString(
          nodeAddress.nodeAccountId.toString(),
        )._toProtobuf();
      }

      // Node Cert Hash
      if (typeof nodeAddress.nodeCertHash === 'string') {
        nodeAddress.nodeCertHash = Uint8Array.from(Buffer.from(nodeAddress.nodeCertHash, 'utf-8'));
      }

      // Service Endpoints
      if (nodeAddress.serviceEndpoint) {
        nodeAddress.serviceEndpoint = nodeAddress.serviceEndpoint.map((endpoint: any) => {
          if (typeof endpoint.ipAddressV4 === 'string') {
            const ipAddressV4 = endpoint.ipAddressV4;
            endpoint.ipAddressV4 = Uint8Array.from(ipAddressV4.split('.').map((b: string) => Number(b)));
          }
          if (endpoint.port) {
            endpoint.port = Number(endpoint.port);
          }
          return endpoint;
        });
      }
    });
  }
  return nodeAddressBook;
}

/**
 * Encodes the services configuration list from a properties file into a binary file.
 */
export function encodeServicesConfigurationList(filePath: string, outputFilePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const settings = parsePropertiesContent(content);
  const properties = proto.ServicesConfigurationList.create({
    nameValue: settings,
  });
  const encodedBytes = proto.ServicesConfigurationList.encode(properties).finish();
  fs.writeFileSync(outputFilePath, Buffer.from(encodedBytes));
  console.log(`Services configuration list has been encoded and written to ${outputFilePath}`);
}

/**
 * Parses the content of a properties file into an array of proto.Setting objects.
 */
function parsePropertiesContent(content: any) {
  const lines = content.split('\n');
  return lines
    .map((line: string) => line.trim())
    .filter((line: string) => line && !line.startsWith('#')) // Ignore empty lines and comments
    .map((line: string) => {
      const index = line.indexOf('=');
      if (index > -1) {
        const name = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        return proto.Setting.create({
          name: name,
          value: value,
        });
      } else {
        // Line does not contain '=', skip it or handle as needed
        return null;
      }
    })
    .filter((setting: any) => setting !== null);
}

/**
 * Encodes the throttle definitions JSON into a binary file.
 */
export function encodeThrottleDefinitions(jsonFilePath: string, outputFilePath: string) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file` + (error instanceof Error ? `: ${error.message}` : ''),
    );
  }
  const formattedData = formatThrottleDefinitions(data);
  const protoMessage = proto.ThrottleDefinitions.create(formattedData);
  const encodedBytes = proto.ThrottleDefinitions.encode(protoMessage).finish();
  fs.writeFileSync(outputFilePath, Buffer.from(encodedBytes));
  console.log(`Throttle definitions have been encoded and written to ${outputFilePath}`);
}

/**
 * Formats the ThrottleDefinitions object.
 */
function formatThrottleDefinitions(throttleDefinitions: any) {
  if (throttleDefinitions.throttleBuckets && Array.isArray(throttleDefinitions.throttleBuckets)) {
    throttleDefinitions.throttleBuckets.forEach((throttleBucket: any) => {
      // Throttle Groups
      if (throttleBucket.throttleGroups) {
        throttleBucket.throttleGroups.forEach((throttleGroup: any) => {
          // Operations
          if (throttleGroup.operations && Array.isArray(throttleGroup.operations)) {
            throttleGroup.operations = throttleGroup.operations.map((operation: any) => {
              if (typeof operation === 'string') {
                return proto.HederaFunctionality[operation as keyof typeof proto.HederaFunctionality];
              } else {
                return operation;
              }
            });
          }

          // milliOpsPerSec
          if (throttleGroup.milliOpsPerSec) {
            throttleGroup.milliOpsPerSec = Long.fromString(
              throttleGroup.milliOpsPerSec.toString(),
              false,
            );
          }
        });
      }

      // Remove unused property burstPeriod if exists
      delete throttleBucket.burstPeriod;

      // burstPeriodMs
      if (throttleBucket.burstPeriodMs) {
        throttleBucket.burstPeriodMs = Long.fromString(
          throttleBucket.burstPeriodMs.toString(),
          false,
        );
      }
    });
  }
  return throttleDefinitions;
}
