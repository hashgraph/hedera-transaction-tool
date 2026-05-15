import axios, { AxiosError } from 'axios';

export enum ActionStatus {
  Success,
  Warning,
  Error,
}

export interface ActionReport {
  status: ActionStatus;
  title: string;
  what: string;
  why?: string;
  next?: string;
  error?: unknown;
}

const genericTitle = 'Operation failed';
const genericNext = 'Contact support team';

export function makeGenericErrorReport(error: unknown): ActionReport | null {
  let result: ActionReport | null;

  if (axios.isAxiosError(error)) {
    // See https://axios-http.com/docs/handling_errors
    if (error.response) {
      const isMirrorNode = isMirrorNodeError(error);
      switch (error.response.status) {
        case 429:
          result = {
            status: ActionStatus.Error,
            title: genericTitle,
            what: isMirrorNode ? 'Mirror node is overloaded' : 'Server is overloaded',
            why: error.message,
            next: 'Try again later'
          };
          break;
        default:
          result = {
            status: ActionStatus.Error,
            title: genericTitle,
            what: isMirrorNode ? 'Mirror node returned an error' : 'Server returned an error',
            why: error.message,
            next: genericNext,
          };
          break;
      }
    } else if (error.request) {
      const isMirrorNode = isMirrorNodeError(error);
      result = {
        status: ActionStatus.Error,
        title: genericTitle,
        what: isMirrorNode ? 'Failed to contact mirror node' : 'Failed to contact server',
        why: isMirrorNode ? 'Mirror node is unreachable' : 'Server is unreachable',
        next: 'Check your network connection',
      };
    } else {
      result = {
        status: ActionStatus.Error,
        title: genericTitle,
        what: 'Unexpected Network failure',
        why: error.message,
        next: genericNext,
      };
    }
  } else {
    result = null;
  }
  return result;
}

export function makeUncontrolledErrorReport(error: unknown): ActionReport {
  let result = makeGenericErrorReport(error);
  if (result === null) {
    result = {
      status: ActionStatus.Error,
      title: genericTitle,
      what: 'Operation failed to complete',
      why: error instanceof Error ? error.message : JSON.stringify(error),
      next: genericNext,
    };
  }
  return result;
}

export function makeBugReport(title: string, what: string, error?: unknown): ActionReport {
  return {
    status: ActionStatus.Error,
    title,
    what,
    why: 'An internal error occurred',
    next: genericNext,
    error,
  };
}

function isMirrorNodeError(error: AxiosError): boolean {
  return error.config?.url?.includes('mirrornode') ?? false;
}
