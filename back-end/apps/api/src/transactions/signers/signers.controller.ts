import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  transformAndValidateDto,
  withPaginatedResponse,
} from '@app/common';
import { TransactionSigner, User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { GetUser } from '../../decorators';

import {
  UploadSignatureMapDto,
  TransactionSignerDto,
  TransactionSignerUserKeyDto,
  TransactionSignerFullDto,
} from '../dto';

import { SignersService } from './signers.service';

@ApiTags('Transaction Signers')
@Controller('transactions/:transactionId?/signers')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class SignersController {
  constructor(private signaturesService: SignersService) {}

  /* Returns all signatures for a particular transaction */
  @ApiOperation({
    summary: 'Get transaction signatures for a transaction',
    description: 'Get all transaction signatures for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionSignerUserKeyDto],
  })
  @Get()
  @HttpCode(200)
  getSignaturesByTransactionId(
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByTransactionId(transactionId, true);
  }

  /* Returns all signatures for a particular user for the transaction */
  @ApiOperation({
    summary: 'Get signatures for user',
    description:
      'Get all transaction signatures for the current user for the transaction with the given id.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionSignerDto],
  })
  @Get('/user')
  @HttpCode(200)
  @Serialize(withPaginatedResponse(TransactionSignerDto))
  async getSignaturesByUser(
    @GetUser() user: User,
    @PaginationParams() pagination: Pagination,
  ): Promise<PaginatedResourceDto<TransactionSigner>> {
    return this.signaturesService.getSignaturesByUser(user, pagination, true);
  }

  /* Upload one or more signature maps for one or more transactions */
  @ApiOperation({
    summary: 'Upload one or more signature maps for one or more transactions',
    description:
      'Upload one or more signature maps for one or more transaction. Each signature map must have the following structure: node account ID -> transaction ID -> DER public key -> signature.',
  })
  @ApiBody({
    type: [UploadSignatureMapDto],
  })
  @ApiResponse({
    status: 201,
    type: [TransactionSignerFullDto],
  })
  @Post()
  @HttpCode(201)
  @Serialize(TransactionSignerFullDto)
  async uploadSignatureMap(
    @Body() body: UploadSignatureMapDto | UploadSignatureMapDto[],
    @GetUser() user: User,
  ): Promise<TransactionSigner[]> {
    const transformedSignatureMaps = await transformAndValidateDto(UploadSignatureMapDto, body);

    return this.signaturesService.uploadSignatureMaps(transformedSignatureMaps, user);
  }
}
