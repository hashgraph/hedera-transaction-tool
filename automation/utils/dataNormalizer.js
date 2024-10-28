/**
 * Normalizes exchange rate data by converting specific fields to standard names and formats.
 * @param data - The exchange rate data object to normalize.
 * @returns {{}} - The normalized exchange rate data object.
 */

function normalizeExchangeRateData(data) {
  const normalizedData = {};

  for (const rateType of ['currentRate', 'nextRate']) {
    if (data[rateType]) {
      const rateData = data[rateType];
      const normalizedRate = {};

      // Map hbarEquiv to hbars
      normalizedRate.hbars = rateData.hbars || rateData.hbarEquiv;
      // Map centEquiv to cents
      normalizedRate.cents = rateData.cents || rateData.centEquiv;

      // Handle expirationTime
      if (rateData.expirationTime) {
        if (typeof rateData.expirationTime === 'string') {
          normalizedRate.expirationTime = rateData.expirationTime;
        } else if (typeof rateData.expirationTime === 'object' && rateData.expirationTime.seconds) {
          // Convert seconds to ISO string
          const date = new Date(Number(rateData.expirationTime.seconds) * 1000);
          normalizedRate.expirationTime = date.toISOString();
        }
      }

      // Include exchangeRateInCents if present
      if (rateData.exchangeRateInCents !== undefined) {
        normalizedRate.exchangeRateInCents = rateData.exchangeRateInCents;
      }

      normalizedData[rateType] = normalizedRate;
    }
  }

  return normalizedData;
}

/**
 * Normalizes throttle data by converting specific numeric string fields to numbers.
 * @param {object} data - The throttle data object to normalize.
 * @returns {object} - The normalized data object.
 */
function normalizeThrottleData(data) {
  function traverse(obj) {
    if (Array.isArray(obj)) {
      return obj.map(traverse);
    } else if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'milliOpsPerSec' || key === 'burstPeriodMs') {
            if (typeof obj[key] === 'string') {
              obj[key] = parseInt(obj[key], 10);
            }
          } else {
            obj[key] = traverse(obj[key]);
          }
        }
      }
      return obj;
    } else {
      return obj;
    }
  }
  return traverse(data);
}

module.exports = {
  normalizeExchangeRateData,
  normalizeThrottleData,
};
