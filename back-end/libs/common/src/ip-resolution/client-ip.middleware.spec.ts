import { Request, Response } from 'express';

import { ClientIpMiddleware } from './client-ip.middleware';
import { CLIENT_IP_KEY } from './client-ip.types';
import { IpResolverService } from './ip-resolver.service';

describe('ClientIpMiddleware', () => {
  it('stashes the resolved IP on the request and calls next()', () => {
    const resolver = { resolve: jest.fn().mockReturnValue('203.0.113.5') } as unknown as IpResolverService;
    const middleware = new ClientIpMiddleware(resolver);

    const req = {} as Request;
    const next = jest.fn();

    middleware.use(req, {} as Response, next);

    expect(resolver.resolve).toHaveBeenCalledWith(req);
    expect(req[CLIENT_IP_KEY]).toBe('203.0.113.5');
    expect(next).toHaveBeenCalled();
  });
});
