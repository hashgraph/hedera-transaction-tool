import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Transaction, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard, HasKeyGuard } from '../guards';

import { GetUser } from '../decorators/get-user.decorator';

import { Serialize } from '../interceptors/serialize.interceptor';

import { TransactionsService } from './transactions.service';

import { CreateTransactionDto, TransactionDto } from './dto';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
@Serialize(TransactionDto)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  /* Submit a transaction */
  @ApiOperation({
    summary: 'Create a transaction',
    description: 'Create a transaction for the organization to approve, sign, and execute.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionDto,
  })
  @UseGuards(HasKeyGuard)
  @Post()
  createTransaction(@Body() body: CreateTransactionDto, @GetUser() user): Promise<Transaction> {
    return this.transactionsService.createTransaction(body, user);
  }

  /* Get all transactions created by the user */
  @ApiOperation({
    summary: 'Get created transactions',
    description: 'Get all transactions that were created by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get()
  getTransactions(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactions(user, take, skip);
  }

  /* Get all transactions to be signed by the user */
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

  /* Get all transactions to be approved by the user */
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

  /* Get all transactions to be observed by the user */
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
    description:
      'Update the transaction for the given transaction id. ' +
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
