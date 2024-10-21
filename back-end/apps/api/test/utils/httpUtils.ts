import * as request from 'supertest';

import { NestExpressApplication } from '@nestjs/platform-express';

type ServerType = ReturnType<NestExpressApplication['getHttpServer']>;

export const req = (
  server: ServerType,
  type: 'get' | 'post' | 'put' | 'delete' | 'patch',
  endpoint: string,
  token?: string,
) => {
  const req = request(server)[type](endpoint);

  if (token) {
    req.set('Authorization', `bearer ${token}`);
  }

  return req;
};

export const get = (server: ServerType, endpoint: string, token?: string) =>
  req(server, 'get', endpoint, token);

export const post = (server: ServerType, endpoint: string, token?: string) =>
  req(server, 'post', endpoint, token);

export const put = (server: ServerType, endpoint: string, token?: string) =>
  req(server, 'put', endpoint, token);

export const del = (server: ServerType, endpoint: string, token?: string) =>
  req(server, 'delete', endpoint, token);

export const patch = (server: ServerType, endpoint: string, token?: string) =>
  req(server, 'patch', endpoint, token);

export class Endpoint {
  public endpoint: string;
  public server: ServerType;

  constructor(server: ServerType, endpoint: string) {
    this.endpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    this.server = server;
  }

  public get(param?: string, token?: string, query?: string) {
    return get(this.server, this.createEndpoint(param, query), token);
  }

  public post(data?, param?: string, token?: string) {
    if (data) {
      return post(this.server, this.createEndpoint(param), token).send(data);
    }
    return post(this.server, this.createEndpoint(param), token);
  }

  public put(data?, param?: string, token?: string) {
    if (data) {
      return put(this.server, this.createEndpoint(param), token).send(data);
    }
    return put(this.server, this.createEndpoint(param), token);
  }

  public patch(data?, param?: string, token?: string) {
    if (data) {
      return patch(this.server, this.createEndpoint(param), token).send(data);
    }
    return patch(this.server, this.createEndpoint(param), token);
  }

  public delete(param?: string, token?: string) {
    return del(this.server, this.createEndpoint(param), token);
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
