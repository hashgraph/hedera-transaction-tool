import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post, Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { GetUser } from '../decorators/get-user.decorator';
import { User } from '@entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from '@entities/transaction.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Serialize } from '../interceptors/serialize.interceptor';
import { TransactionDto } from './dto/transaction.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionDto)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @ApiOperation({
    summary: 'Create a transaction',
    description: 'Create a transaction for the organization for the given information.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionDto,
  })
  @Post()
  createTransaction(@Body() body: CreateTransactionDto): Promise<Transaction> {
    return this.transactionsService.createTransaction(body);
  }

  @ApiOperation({
    summary: 'Get created transactions',
    description: 'Get all transactions that were created by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get()
  getTransactions(@GetUser() user: User): Promise<Transaction[]> {
    return this.transactionsService.getTransactions(user);
  }

  @ApiOperation({
    summary: 'Get transactions to sign',
    description: 'Get all transactions to be signed by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/sign')
  getTransactionsToSign(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsToSign(user, take, skip);
  }

  @ApiOperation({
    summary: 'Get transactions to approve',
    description: 'Get all transactions to be approved by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/approve')
  getTransactionsToApprove(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsToApprove(user, take, skip);
  }

  @ApiOperation({
    summary: 'Get transactions to observe',
    description: 'Get all transactions to be observed by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/observe')
  getTransactionsToObserve(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsToObserve(user, take, skip);
  }

  @ApiOperation({
    summary: 'Get a transaction',
    description: 'Get the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionDto,
  })
  @Get('/:id')
  //TODO @UseGuards(ensure user can access this transaction)
  getTransaction(@Param('id', ParseIntPipe) id: number): Promise<Transaction> {
    return this.transactionsService.getTransactionById(id);
  }

  @ApiOperation({
    summary: 'Update a transaction',
    description: 'Update the transaction for the given transaction id. ' +
      'WARNING: Updating a transaction that is already approved or signed should not be allowed.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionDto,
  })
  @Patch('/:id')
  //TODO @UseGuards(ensure user is creator and that the transaction has no signatures?either that or delete sigs and reset
  // approvals)
  //TODO and use an UpdateTransactionDto
  updateTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.updateTransaction(id, body);
  }

  @ApiOperation({
    summary: 'Remove a transaction',
    description: 'Remove the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
  })
  @Delete('/:id')
  removeTransaction(@Param('id', ParseIntPipe) id: number): void {
    this.transactionsService.removeTransaction(id);
  }
}
