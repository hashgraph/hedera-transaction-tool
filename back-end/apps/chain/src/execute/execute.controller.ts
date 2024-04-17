import { Controller, Get } from '@nestjs/common';

@Controller('execute')
export class ExecuteController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}
