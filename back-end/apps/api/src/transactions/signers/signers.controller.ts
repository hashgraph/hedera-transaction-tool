import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { TransactionSigner, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../../guards';

import { GetUser } from '../../decorators/get-user.decorator';

import { SignersService } from './signers.service';

import {
  UploadSignatureDto,
  TransactionSignerDto,
  TransactionSignerUserKeyDto,
  TransactionSignerFullDto,
} from '../dto';

@ApiTags('Transaction Signers')
@Controller('transactions/:transactionId?/signers')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
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
  @Serialize(TransactionSignerDto)
  async getSignaturesByUser(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByUser(user, take, skip, true);
  }

  /* Uploads a signature for particular transaction */
  @ApiOperation({
    summary: 'Upload a signature map for a transaction',
    description:
      'Upload a siganture map and user key id with which the transaction is signed. The signature map must be an object containing node account ids for which the signature is valid',
  })
  @ApiBody({
    type: UploadSignatureDto,
  })
  @ApiResponse({
    status: 201,
    type: TransactionSignerFullDto,
  })
  @Post()
  @HttpCode(201)
  @Serialize(TransactionSignerFullDto)
  uploadSignature(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: UploadSignatureDto,
    @GetUser() user: User,
  ): Promise<TransactionSigner> {
    return this.signaturesService.uploadSignature(transactionId, body, user);
  }
}
