import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { GetUser } from '../decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from '../entities/transaction.entity';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Serialize } from '../interceptors/serialize.interceptor';
import { TransactionDto } from './dto/transaction.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionDto)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post()
  createTransaction(@Body() body: CreateTransactionDto) {
    return this.transactionsService.createTransaction(body);
  }

  @Get()
  async getTransactions(@GetUser() user: User): Promise<Transaction[]> {
    const transactions = await this.transactionsService.getTransactions(user);
    return transactions;
  }

  @Get('/:id')
  //TODO @UseGuards(ensure user can access this transaction)
  getTransaction(@Param('id', ParseIntPipe) id: number): Promise<Transaction> {
    return this.transactionsService.getTransactionById(id);
  }

  @Patch('/:id')
  //TODO @UseGuards(ensure user is creator and that the transaction has no signatures?either that or delete sigs and reset
  // approvals)
  //TODO and use an UpdateTransactionDto
  updateTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateTransactionDto,
  ) {
    return this.transactionsService.updateTransaction(id, body);
  }

  @Delete('/:id')
  removeTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.removeTransaction(id);
  }
}
