import * as authService from './auth';
export * from './auth';

export const resetData = async (
  email: string,
  options: { authData?: boolean; keys?: boolean; transactions?: boolean; organizations?: boolean },
) => {
  if (options.authData) {
    await authService.clear(email);
  }
};
