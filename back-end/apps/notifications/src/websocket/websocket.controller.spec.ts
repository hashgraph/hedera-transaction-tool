import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';

import { WebsocketController } from './websocket.controller';
import { WebsocketGateway } from './websocket.gateway';
import { NotifyClientDto } from '@app/common';
import { RmqContext } from '@nestjs/microservices';

describe('WebsocketController', () => {
  let controller: WebsocketController;
  const gateway = mockDeep<WebsocketGateway>();
  const configService = mockDeep<ConfigService>();

  const mockCtx = {
    getChannelRef: () => ({ ack: jest.fn() }),
    getMessage: () => ({ properties: { headers: {} } }),
  } as unknown as RmqContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebsocketController],
      providers: [
        {
          provide: WebsocketGateway,
          useValue: gateway,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    controller = module.get<WebsocketController>(WebsocketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should notify the connected client', async () => {
    const payload: NotifyClientDto = { message: 'Test message', content: 'Test content' };

    await controller.notifyClient(payload, mockCtx);

    expect(gateway.notifyClient).toHaveBeenCalledWith(payload);
  });

  it('should get the port', async () => {
    const port = 3000;
    configService.get.mockReturnValueOnce(port);

    const result = await controller.getPort();

    expect(result).toBe(port);
  });
});
