import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '@app/common';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';

describe('HealthController', () => {
  let controller: HealthController;
  let natsService: { isConnected: jest.Mock };

  beforeEach(async () => {
    natsService = {
      isConnected: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: NatsJetStreamService,
          useValue: natsService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return status ok with nats connected', () => {
    natsService.isConnected.mockReturnValue(true);
    expect(controller.health()).toEqual({
      status: 'ok',
      nats: 'connected',
    });
  });

  it('should return status ok with nats disconnected', () => {
    natsService.isConnected.mockReturnValue(false);
    expect(controller.health()).toEqual({
      status: 'ok',
      nats: 'disconnected',
    });
  });
});
