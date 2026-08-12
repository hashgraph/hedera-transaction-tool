import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { EntityRole } from './entity-role.enum';

@Entity()
@Index(['transactionId', 'hederaEntityId', 'network', 'entityRole'], { unique: true })
@Index(['hederaEntityId', 'network'])
export class TransactionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column()
  transactionId: number;

  @Column()
  hederaEntityId: string;

  @Column()
  network: string;

  @Column()
  entityRole: EntityRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
