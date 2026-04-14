export function calculateTimeout(totalUsers: number, timePerUser: number): number {
  return totalUsers * timePerUser * 2000;
}

/**
 * Waits until a transaction start time becomes valid.
 * Supports both Hedera UI format and ISO date formats.
 */
export async function waitForValidStart(
  dateTimeString: string,
  bufferSeconds: number = 15,
): Promise<void> {
  if (!dateTimeString || !dateTimeString.trim()) {
    console.log('waitForValidStart: start time is empty. Skipping wait.');
    return;
  }

  let normalizedDate = dateTimeString.trim();

  if (normalizedDate.endsWith(' UTC')) {
    normalizedDate = normalizedDate.replace(' UTC', ' GMT');
  }

  if (
    !normalizedDate.endsWith('Z') &&
    !normalizedDate.includes('GMT') &&
    !normalizedDate.includes('+')
  ) {
    normalizedDate = `${normalizedDate}Z`;
  }

  const targetDate = new Date(normalizedDate);

  if (isNaN(targetDate.getTime())) {
    throw new Error(
      `waitForValidStart: invalid date string. Original: "${dateTimeString}", normalized: "${normalizedDate}"`,
    );
  }

  const now = new Date();
  const timeDifference = targetDate.getTime() - now.getTime();
  const waitTime = Math.max(timeDifference + bufferSeconds * 1000, 0);

  if (waitTime > 0) {
    const seconds = Math.ceil(waitTime / 1000);
    console.log(`Waiting ${seconds} seconds until transaction start time becomes valid...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log('The target start time has already passed.');
  }
}
