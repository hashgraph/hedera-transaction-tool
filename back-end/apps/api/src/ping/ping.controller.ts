import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '../interceptors/serialize.interceptor';
import { ServerStatusDto } from './dtos/server-status.dto';

@ApiTags('Ping')
@Controller('ping')
@Serialize(ServerStatusDto)
export class PingController {
  @ApiOperation({
    summary: 'Returns whether the server is running',
    description: 'Returns a simple message to confirm that the server is running.',
  })
  @ApiResponse({
    status: 200,
    type: ServerStatusDto,
  })
  @Get()
  ping() {
    return { status: 'ok' };
  }
}
