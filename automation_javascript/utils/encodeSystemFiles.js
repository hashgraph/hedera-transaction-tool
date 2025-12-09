const fs = require('fs');
const { proto } = require('@hashgraph/proto');
const Long = require('long');
const { AccountId } = require('@hashgraph/sdk');

/**
 * Reads the exchange rates JSON file, encodes it into binary, and writes to a .bin file.
 */
function encodeExchangeRates(jsonFilePath, outputFilePath) {
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
function formatExchangeRateSet(data) {
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
function formatExchangeRate(rate) {
  if (rate.expirationTime) {
    console.log(rate.expirationTime);
    rate.expirationTime = proto.TimestampSeconds.create({
      seconds: Long.fromValue(rate.expirationTime.seconds),
    });
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
function encodeFeeSchedule(jsonFilePath, outputFilePath) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${error.message}`);
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
function formatCurrentAndNextFeeSchedule(data) {
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
function formatFeeSchedule(feeSchedule) {
  if (feeSchedule.expiryTime) {
    feeSchedule.expiryTime = proto.TimestampSeconds.create({
      seconds: Long.fromString(feeSchedule.expiryTime.toString(), true),
    });
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
function formatTransactionFeeSchedule(txFeeSchedule) {
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
function formatFeeData(feeData) {
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
function formatFeeComponents(feeComponents) {
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
function encodeNodeAddressBook(jsonFilePath, outputFilePath) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${error.message}`);
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
function formatNodeAddressBook(nodeAddressBook) {
  if (nodeAddressBook.nodeAddress) {
    nodeAddressBook.nodeAddress.forEach(nodeAddress => {
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
        nodeAddress.serviceEndpoint = nodeAddress.serviceEndpoint.map(endpoint => {
          if (typeof endpoint.ipAddressV4 === 'string') {
            const ipAddressV4 = endpoint.ipAddressV4;
            endpoint.ipAddressV4 = Uint8Array.from(ipAddressV4.split('.').map(b => Number(b)));
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
function encodeServicesConfigurationList(filePath, outputFilePath) {
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
function parsePropertiesContent(content) {
  const lines = content.split('\n');
  return lines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')) // Ignore empty lines and comments
    .map(line => {
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
    .filter(setting => setting !== null);
}

/**
 * Encodes the throttle definitions JSON into a binary file.
 */
function encodeThrottleDefinitions(jsonFilePath, outputFilePath) {
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${error.message}`);
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
function formatThrottleDefinitions(throttleDefinitions) {
  if (throttleDefinitions.throttleBuckets) {
    throttleDefinitions.throttleBuckets.forEach(throttleBucket => {
      // Throttle Groups
      if (throttleBucket.throttleGroups) {
        throttleBucket.throttleGroups.forEach(throttleGroup => {
          // Operations
          if (throttleGroup.operations) {
            throttleGroup.operations = throttleGroup.operations.map(operation => {
              if (typeof operation === 'string') {
                return proto.HederaFunctionality[operation];
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

module.exports = {
  encodeExchangeRates,
  encodeFeeSchedule,
  encodeNodeAddressBook,
  encodeServicesConfigurationList,
  encodeThrottleDefinitions,
};
