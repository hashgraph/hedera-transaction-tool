/**
 * Recursively traverses an object or array and applies a callback to each key-value pair.
 * @param {any} obj - The input data to traverse.
 * @param {Function} callback - The function to apply to each key-value pair.
 * @returns {any} - The transformed data.
 */
function deepTraverse(
  obj: any,
  callback: (key: string, value: any) => { newKey: string; newValue: any },
): any {
  if (Array.isArray(obj)) {
    return obj.map((item: any) => deepTraverse(item, callback));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: Record<string, any> = {};
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
export function normalizeExchangeRateData(data: any) {
  const keyMappings: Record<string, string> = {
    hbarEquiv: 'hbars',
    centEquiv: 'cents',
  };

  function callback(key: string, value: any) {
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
export function normalizeThrottleData(data: any) {
  function callback(key: string, value: any) {
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
export function normalizeFeeScheduleData(data: any) {
  const keyMappings: Record<string, string> = {
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

  function callback(key: string, value: any) {
    const newKey = keyMappings[key] || key;
    return { newKey, newValue: value };
  }

  return deepTraverse(data, callback);
}
