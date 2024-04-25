import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PingModule } from './ping.module';
import { PingController } from './ping.controller';

describe('PingModule', () => {
  let pingModule: TestingModule;

  beforeEach(async () => {
    pingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), PingModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(pingModule).toBeDefined();
  });

  it('should have the PingController', () => {
    const pingController = pingModule.get<PingController>(PingController);
    expect(pingController).toBeDefined();
  });
});
