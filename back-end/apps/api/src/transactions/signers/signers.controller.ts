import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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
    summary: 'Get a signature',
    description: 'Get the transaction signature for the given signature id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionSignerDto,
  })
  @Get('/:id')
  getSignatureById(@Param('id', ParseIntPipe) id: number): Promise<TransactionSigner> {
    return this.signaturesService.getSignatureById(id);
  }

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

  @ApiOperation({
    summary: 'Upload a signature',
    description: 'Upload the signature for the given transaction id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionSignerDto,
  })
  @Post()
  uploadSignature(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: UploadSignatureDto,
  ): Promise<TransactionSigner> {
    return this.signaturesService.uploadSignature(transactionId, body);
  }

  @ApiOperation({
    summary: 'Delete a signature',
    description: 'Delete the signature for the given transaction signature id.',
  })
  @ApiResponse({
    status: 201,
  })
  @Delete('/:id')
  removeSignature(@Param('id', ParseIntPipe) id: number): void {
    this.signaturesService.removeSignature(id);
  }
}
