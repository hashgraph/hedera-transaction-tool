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
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { Serialize } from '../../interceptors/serialize.interceptor';
import { TransactionObserverDto } from '../dto/transaction-observer.dto';
import { ObserversService } from './observers.service';
import { CreateTransactionObserverDto } from '../dto/create-transaction-observer.dto';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '../../entities/user.entity';
import { UpdateTransactionObserverDto } from '../dto/update-transaction-observer.dto';
import { TransactionObserver } from '../../entities/transaction-observer.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transaction Observers')
@Controller('transactions/:transactionId?/observers')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionObserverDto)
export class ObserversController {
  constructor(private observersService: ObserversService) {}

  @Post()
  createTransactionObserver(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: CreateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    return this.observersService.createTransactionObserver(transactionId, body);
  }

  @Get()
  getTransactionObserversByTransactionId(
    @Param('transactionId', ParseIntPipe) id: number,
  ): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByTransactionId(id);
  }

  @Get('/user')
  getTransactionObserversByUser(@GetUser() user: User): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByUserId(user.id);
  }

  @Get('/user/:userId')
  getTransactionObserversByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByUserId(userId);
  }

  // Routes with a param need to be listed last
  @Get('/:id')
  getTransactionObserverById(@Param('id', ParseIntPipe) id: number): Promise<TransactionObserver> {
    return this.observersService.getTransactionObserverById(id);
  }

  @Patch('/:id')
  updateTransactionObserver(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    return this.observersService.updateTransactionObserver(id, body);
  }

  @Delete('/:id')
  removeTransactionObserver(@Param('id', ParseIntPipe) id: number): void {
    this.observersService.removeTransactionObserver(id);
  }
}
