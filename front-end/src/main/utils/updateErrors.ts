export type UpdateErrorType = 'network' | 'connection-refused' | 'invalid-url' | 'generic';

export interface CategorizedError {
  type: UpdateErrorType;
  message: string;
  details: string;
}

export function categorizeUpdateError(error: Error | string): CategorizedError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;
  const errorName = typeof error === 'string' ? 'Unknown' : error.name;

  const lowerMessage = errorMessage.toLowerCase();
  const details = errorStack || errorMessage;

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('dns') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('eai_again') ||
    errorName === 'NetworkError'
  ) {
    return {
      type: 'network',
      message: 'No internet connection or the server could not be reached.',
      details,
    };
  }

  if (
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('403') ||
    lowerMessage.includes('blocked') ||
    lowerMessage.includes('firewall') ||
    lowerMessage.includes('proxy')
  ) {
    return {
      type: 'connection-refused',
      message: 'The update server could not be reached (connection refused or blocked).',
      details,
    };
  }

  if (
    lowerMessage.includes('invalid url') ||
    lowerMessage.includes('malformed') ||
    lowerMessage.includes('einvval') ||
    lowerMessage.includes('url parse') ||
    lowerMessage.includes('404') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('feed') ||
    lowerMessage.includes('update info') ||
    errorName === 'TypeError' ||
    errorName === 'SyntaxError'
  ) {
    return {
      type: 'invalid-url',
      message: 'The update URL is invalid or misconfigured.',
      details,
    };
  }

  return {
    type: 'generic',
    message: 'An error occurred while updating.',
    details,
  };
}
