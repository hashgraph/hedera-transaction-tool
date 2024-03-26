import { Controller, Get } from '@nestjs/common';
import { ChainService } from './chain.service';

@Controller()
export class ChainController {
  constructor(private readonly chainService: ChainService) {}

  @Get()
  getHello(): string {
    return this.chainService.getHello();
  }
}
