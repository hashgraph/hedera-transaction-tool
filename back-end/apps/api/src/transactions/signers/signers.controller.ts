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

import { TransactionSigner, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../../guards';

import { GetUser } from '../../decorators/get-user.decorator';

import { Serialize } from '../../interceptors/serialize.interceptor';

import { SignersService } from './signers.service';

import { UploadSignatureDto } from '../dto/upload-signature.dto';
import { TransactionSignerDto } from '../dto/transaction-signer.dto';

@ApiTags('Transaction Signers')
@Controller('transactions/:transactionId?/signers')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
@Serialize(TransactionSignerDto)
export class SignersController {
  constructor(private signaturesService: SignersService) {}

  @ApiOperation({
    summary: 'Get transaction signatures for a transaction',
    description: 'Get all transaction signatures for the given transaction id.',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionSignerDto],
  })
  @Get()
  getSignaturesByTransactionId(
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByTransactionId(transactionId);
  }

  @ApiOperation({
    summary: 'Get signatures for user',
    description: 'Get all transaction signatures for the current user. IS THIS NEEDED?',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionSignerDto],
  })
  @Get('/user')
  getSignaturesByUser(@GetUser() user: User): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByUser(user);
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
    type: TransactionSignerDto,
  })
  @Post()
  @HttpCode(201)
  uploadSignature(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: UploadSignatureDto,
    @GetUser() user: User,
  ): Promise<TransactionSigner> {
    return this.signaturesService.uploadSignature(transactionId, body, user);
  }
}
