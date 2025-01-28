import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './scheduler.module-definition';

import { SchedulerService } from './scheduler.service';

@Module({
  imports: [],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule extends ConfigurableModuleClass {
  constructor(private readonly schedulerService: SchedulerService) {
    super();
  }

  onModuleDestroy() {
    this.schedulerService.pubClient.quit();
    this.schedulerService.subClient.quit();
  }
}
