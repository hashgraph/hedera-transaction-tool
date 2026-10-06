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

// One row per Hedera entity a transaction references, tagged with the role it plays (see
// EntityRole) — e.g. the fee payer, the sender/receiver of a transfer, the account/file/
// node being targeted. Populated once at transaction-creation time by
// TransactionsService.extractTransactionEntities and read only by
// ReviewerAssignmentService, which matches these rows against ReviewerRule.hederaId to
// decide which reviewer groups a transaction gets assigned to.
//
// hederaId is not a foreign key — Hedera accounts/files/nodes/tokens/topics aren't
// modeled as local tables, so it's just the external id as a string, scoped by entityRole.
@Entity()
@Index(['transactionId', 'hederaId', 'network', 'entityRole'], { unique: true })
@Index(['hederaId', 'network'])
export class TransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction;

  @Column()
  transactionId!: number;

  // A Hedera entity ID (e.g. "0.0.1234") for most entityRoles, or a plain node ID
  // (e.g. "7") when entityRole is 'node'.
  @Column()
  hederaId!: string;

  @Column()
  network!: string;

  @Column()
  entityRole!: EntityRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
