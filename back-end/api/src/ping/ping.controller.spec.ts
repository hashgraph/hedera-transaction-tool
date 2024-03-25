import { Test, TestingModule } from '@nestjs/testing';

import { PingController } from './ping.controller';

import { ServerStatusDto } from './dtos/server-status.dto';

describe('PingController', () => {
  let controller: PingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();

    controller = module.get<PingController>(PingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return correct DTO', async () => {
    const result = await controller.ping();

    const serverStatusDto = new ServerStatusDto();
    serverStatusDto.status = 'ok';

    expect(result).toEqual(serverStatusDto);
  });
});
