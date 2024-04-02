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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Serialize } from '../../interceptors/serialize.interceptor';
import { TransactionObserverDto } from '../dto/transaction-observer.dto';
import { ObserversService } from './observers.service';
import { CreateTransactionObserverDto } from '../dto/create-transaction-observer.dto';
import { GetUser } from '../../decorators/get-user.decorator';
import { UpdateTransactionObserverDto } from '../dto/update-transaction-observer.dto';
import { TransactionObserver, User } from '@entities/';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Transaction Observers')
@Controller('transactions/:transactionId?/observers')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionObserverDto)
export class ObserversController {
  constructor(private observersService: ObserversService) {}

  @ApiOperation({
    summary: 'Create a transaction observer',
    description: 'Create a transaction observer for the given transaction with the provided data.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionObserverDto,
  })
  @Post()
  createTransactionObserver(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: CreateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    return this.observersService.createTransactionObserver(transactionId, body);
  }

  @ApiOperation({
    summary: 'Get transaction observers for a transaction',
    description: 'Get all transaction observers for the given transaction id.',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionObserverDto],
  })
  @Get()
  getTransactionObserversByTransactionId(
    @Param('transactionId', ParseIntPipe) id: number,
  ): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByTransactionId(id);
  }

  @ApiOperation({
    summary: 'Get transaction observers for current user',
    description: 'Get all transaction observers for the current user. IS THIS NEEDED?',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionObserverDto],
  })
  @Get('/user')
  getTransactionObserversByUser(@GetUser() user: User): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByUserId(user.id);
  }

  @ApiOperation({
    summary: 'Get transaction observers for user',
    description: 'Get all transaction observers for the given user id. IS THIS NEEDED?',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionObserverDto],
  })
  @Get('/user/:userId')
  getTransactionObserversByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByUserId(userId);
  }

  // Routes with a param need to be listed last
  @ApiOperation({
    summary: 'Get a transaction observer',
    description: 'Get the transaction observer for the given transaction observer id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionObserverDto,
  })
  @Get('/:id')
  getTransactionObserverById(@Param('id', ParseIntPipe) id: number): Promise<TransactionObserver> {
    return this.observersService.getTransactionObserverById(id);
  }

  @ApiOperation({
    summary: 'Update a transaction observer',
    description:
      'Update the transaction observer with the provided information for the given transaction observer id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionObserverDto,
  })
  @Patch('/:id')
  updateTransactionObserver(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    return this.observersService.updateTransactionObserver(id, body);
  }

  @ApiOperation({
    summary: 'Delete a transaction observer',
    description: 'Delete the transaction observer for the given transaction observer id.',
  })
  @ApiResponse({
    status: 201,
  })
  @Delete('/:id')
  removeTransactionObserver(@Param('id', ParseIntPipe) id: number): void {
    this.observersService.removeTransactionObserver(id);
  }
}
