import type { UpdateErrorType } from '@shared/interfaces/update';

export interface UpdateErrorMessage {
  title: string;
  message: string;
  action: string;
}

export const UPDATE_ERROR_MESSAGES: Record<UpdateErrorType, UpdateErrorMessage> = {
  network: {
    title: 'Connection Error',
    message: 'No internet connection or the server could not be reached.',
    action: 'Please check your network connection and try again.',
  },
  'connection-refused': {
    title: 'Server Unreachable',
    message: 'The update server could not be reached (connection refused or blocked).',
    action: 'Verify that the URL is allowed by your firewall/proxy, or contact support.',
  },
  'invalid-url': {
    title: 'Configuration Error',
    message: 'The update URL is invalid or misconfigured.',
    action: 'Contact support or download the update manually from the releases page.',
  },
  generic: {
    title: 'Update Error',
    message: 'An error occurred while updating.',
    action: 'Please try again later. If the problem persists, download manually.',
  },
};

