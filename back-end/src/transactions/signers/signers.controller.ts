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
import { SignersService } from './signers.service';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { UploadSignatureDto } from '../dto/upload-signature.dto';
import { TransactionSigner } from '../../entities/transaction-signer.entity';
import { TransactionSignerDto } from '../dto/transaction-signer.dto';
import { Serialize } from '../../interceptors/serialize.interceptor';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '../../entities/user.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transaction Signers')
@Controller('transactions/:transactionId?/signers')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionSignerDto)
export class SignersController {
  constructor(private signaturesService: SignersService) {}

  @Get('/:id')
  getSignatureById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TransactionSigner> {
    return this.signaturesService.getSignatureById(id);
  }

  @Get()
  getSignaturesByTransactionId(
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByTransactionId(transactionId);
  }

  @Get('/user')
  getSignaturesByUser(@GetUser() user: User): Promise<TransactionSigner[]> {
    return this.signaturesService.getSignaturesByUser(user);
  }

  @Post()
  uploadSignature(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: UploadSignatureDto,
  ): Promise<TransactionSigner> {
    return this.signaturesService.uploadSignature(transactionId, body);
  }

  @Delete('/:id')
  deleteSignature(@Param('id', ParseIntPipe) id: number): void {
    this.signaturesService.deleteSignature(id);
  }
}
