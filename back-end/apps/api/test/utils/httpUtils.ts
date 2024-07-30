import * as request from 'supertest';

import { NestExpressApplication } from '@nestjs/platform-express';

type ServerType = ReturnType<NestExpressApplication['getHttpServer']>;

export const req = (
  server: ServerType,
  type: 'get' | 'post' | 'put' | 'delete' | 'patch',
  endpoint: string,
  cookie?: string,
) => {
  const req = request(server)[type](endpoint);

  if (cookie) {
    req.set('Cookie', cookie);
  }

  return req;
};

export const get = (server: ServerType, endpoint: string, cookie?: string) =>
  req(server, 'get', endpoint, cookie);

export const post = (server: ServerType, endpoint: string, cookie?: string) =>
  req(server, 'post', endpoint, cookie);

export const put = (server: ServerType, endpoint: string, cookie?: string) =>
  req(server, 'put', endpoint, cookie);

export const del = (server: ServerType, endpoint: string, cookie?: string) =>
  req(server, 'delete', endpoint, cookie);

export const patch = (server: ServerType, endpoint: string, cookie?: string) =>
  req(server, 'patch', endpoint, cookie);

export class Endpoint {
  public endpoint: string;
  public server: ServerType;

  constructor(server: ServerType, endpoint: string) {
    this.endpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    this.server = server;
  }

  public get(param?: string, cookie?: string, query?: string) {
    return get(this.server, this.createEndpoint(param, query), cookie);
  }

  public post(data?, param?: string, cookie?: string) {
    if (data) {
      return post(this.server, this.createEndpoint(param), cookie).send(data);
    }
    return post(this.server, this.createEndpoint(param), cookie);
  }

  public put(data?, param?: string, cookie?: string) {
    if (data) {
      return put(this.server, this.createEndpoint(param), cookie).send(data);
    }
    return put(this.server, this.createEndpoint(param), cookie);
  }

  public patch(data?, param?: string, cookie?: string) {
    if (data) {
      return patch(this.server, this.createEndpoint(param), cookie).send(data);
    }
    return patch(this.server, this.createEndpoint(param), cookie);
  }

  public delete(param?: string, cookie?: string) {
    return del(this.server, this.createEndpoint(param), cookie);
  }

  private createEndpoint(param?: string, query?: string) {
    let result = this.endpoint;

    if (param) {
      result += param.startsWith('/') ? param : `/${param}`;
    }
    if (query) {
      result += query.startsWith('?') ? query : `?${query}`;
    }

    return result.replaceAll('//', '/');
  }
}

export const getCookieRaw = (res: request.Response, name: string) => {
  if (Array.isArray(res.headers['set-cookie'])) {
    const cookies = res.headers['set-cookie'];
    return cookies.find(cookie => cookie.startsWith(name));
  } else {
    return res.headers['set-cookie'];
  }
};

export const getCookieValue = (cookie: string) => {
  const cookiePairs = cookie.split(';');
  const [, cookieValue] = cookiePairs[0].trim().split('=');
  return cookieValue;
};
