export const SESSION_EXPIRED_MESSAGE =
  'Your session may have expired. Try refreshing the page and signing in again.';

export const PUBLIC_KEY_OWNER_DEFAULT_MESSAGE =
  'Failed to get owner of the public key';

export const TRANSACTION_NODE_DEFAULT_MESSAGE =
  'Something went wrong while fetching transaction nodes. Please try again.';

export const PUBLIC_KEY_OWNER_STATUS_MESSAGES: Partial<Record<number, string>> = {
  401: SESSION_EXPIRED_MESSAGE,
  403: 'You don\'t have permission to look up the owner of this public key.',
  404: 'Could not find the owner of the public key.',
  500: 'The server ran into a problem looking up the public key owner. Try again in a moment.',
};

export const TRANSACTION_NODE_STATUS_MESSAGES: Partial<Record<number, string>> = {
  404: 'Could not retrieve transactions. The server may be outdated — please contact your administrator for help.',
  403: "You don't have permission to view transactions for this network.",
  500: 'The server ran into a problem fetching transactions. Try again in a moment.',
};
