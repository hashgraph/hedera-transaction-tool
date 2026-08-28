// The property IpResolverService's result is stashed under by ClientIpMiddleware, and
// read back by the @ClientIp() decorator / anything else that needs the resolved IP.
export const CLIENT_IP_KEY = 'clientIp' as const;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      [CLIENT_IP_KEY]?: string;
    }
  }
}
