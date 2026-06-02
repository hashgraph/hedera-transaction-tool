import axios, { AxiosError } from 'axios';

const healthController = '/';

export const healthCheck = async (serverUrl: string): Promise<boolean> => {
  try {
    const { data } = await axios.get(`${serverUrl}${healthController}`, { timeout: 3000 });
    return data || false;
  } catch (error) {
    // Treat 426 as reachable only when the backend includes usable version
    // metadata. A malformed 426 behaves like an unreachable org.
    if (error instanceof AxiosError && error.response?.status === 426) {
      const data = error.response.data as
        | { latestSupportedVersion?: unknown; minimumSupportedVersion?: unknown }
        | undefined;
      return (
        typeof data?.latestSupportedVersion === 'string' &&
        typeof data?.minimumSupportedVersion === 'string'
      );
    }
    return false;
  }
};
