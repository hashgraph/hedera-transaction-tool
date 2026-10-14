import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiKeyRevokedReason, User } from '@entities';
import { Serialize } from '@app/common';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { GetUser } from '../decorators';

import { ApiKeyRevealDto, ApiKeyStatusDto } from './dtos';
import { ApiKeysService } from './api-keys.service';

// JWT-only, by design - an API key must never be able to manage keys
// (regenerate/revoke/create one), only ever be used for the GET-only read
// routes it's scoped to (see JwtOrApiKeyGuard). Never put JwtOrApiKeyGuard
// (or @AllowApiKey()) on this controller.
@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @ApiOperation({ summary: 'Create a read-only report API key for the current user' })
  @ApiResponse({ status: 201, type: ApiKeyRevealDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Serialize(ApiKeyRevealDto)
  create(@GetUser() user: User) {
    return this.service.create(user);
  }

  @ApiOperation({
    summary: "Regenerate the current user's report API key, invalidating the previous one immediately",
  })
  @ApiResponse({ status: 200, type: ApiKeyRevealDto })
  @Post('regenerate')
  @Serialize(ApiKeyRevealDto)
  regenerate(@GetUser() user: User) {
    return this.service.regenerate(user);
  }

  @ApiOperation({ summary: "Revoke the current user's report API key" })
  @ApiResponse({ status: 200 })
  @Post('revoke')
  revoke(@GetUser() user: User) {
    return this.service.revoke(user.id, ApiKeyRevokedReason.USER, user.id);
  }

  @ApiOperation({ summary: "Get the current user's report API key status" })
  @ApiResponse({ status: 200, type: ApiKeyStatusDto })
  @Get('status')
  @Serialize(ApiKeyStatusDto)
  getStatus(@GetUser() user: User) {
    return this.service.getStatus(user.id);
  }
}
