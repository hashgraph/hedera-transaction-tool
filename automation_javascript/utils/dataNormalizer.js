/**
 * Recursively traverses an object or array and applies a callback to each key-value pair.
 * @param {any} obj - The input data to traverse.
 * @param {Function} callback - The function to apply to each key-value pair.
 * @returns {any} - The transformed data.
 */
function deepTraverse(obj, callback) {
  if (Array.isArray(obj)) {
    return obj.map(item => deepTraverse(item, callback));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) {
        const { newKey, newValue } = callback(key, obj[key]);
        newObj[newKey] = deepTraverse(newValue, callback);
      }
    }
    return newObj;
  } else {
    return obj;
  }
}

/**
 * Normalizes exchange rate data by converting specific fields to standard names and formats.
 * @param {object} data - The exchange rate data object to normalize.
 * @returns {object} - The normalized exchange rate data object.
 */
function normalizeExchangeRateData(data) {
  const keyMappings = {
    hbarEquiv: 'hbars',
    centEquiv: 'cents',
  };

  function callback(key, value) {
    let newKey = keyMappings[key] || key;
    let newValue = value;

    if (['currentRate', 'nextRate'].includes(key)) {
      // Do nothing, proceed to traverse
    } else if (newKey === 'expirationTime') {
      if (typeof value === 'object' && value.seconds) {
        const date = new Date(Number(value.seconds) * 1000);
        newValue = date.toISOString();
      }
    }

    return { newKey, newValue };
  }

  return deepTraverse(data, callback);
}

/**
 * Normalizes throttle data by converting specific numeric string fields to numbers.
 * @param {object} data - The throttle data object to normalize.
 * @returns {object} - The normalized data object.
 */
function normalizeThrottleData(data) {
  function callback(key, value) {
    let newValue = value;
    if (['milliOpsPerSec', 'burstPeriodMs'].includes(key) && typeof value === 'string') {
      newValue = parseInt(value, 10);
    }
    return { newKey: key, newValue };
  }

  return deepTraverse(data, callback);
}

/**
 * Normalizes fee schedule data by renaming specific keys.
 * @param {object} data - The fee schedule data object to normalize.
 * @returns {object} - The normalized data object.
 */
function normalizeFeeScheduleData(data) {
  const keyMappings = {
    currentFeeSchedule: 'current',
    subType: 'feeDataType',
    bpt: 'transactionBandwidthByte',
    vpt: 'transactionVerification',
    rbh: 'transactionRamByteHour',
    sbh: 'transactionStorageByteHour',
    gas: 'contractTransactionGas',
    tv: 'transferVolumeHbar',
    bpr: 'responseMemoryByte',
    sbpr: 'responseDiskByte',
    nextFeeSchedule: 'next',
    expiryTime: 'expirationTime',
  };

  function callback(key, value) {
    const newKey = keyMappings[key] || key;
    return { newKey, newValue: value };
  }

  return deepTraverse(data, callback);
}

module.exports = {
  normalizeExchangeRateData,
  normalizeThrottleData,
  normalizeFeeScheduleData,
};
