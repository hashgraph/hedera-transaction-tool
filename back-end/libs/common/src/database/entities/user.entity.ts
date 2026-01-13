import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserKey } from './user-key.entity';
import { TransactionComment } from './transaction-comment.entity';
import { TransactionObserver } from './transaction-observer.entity';
import { TransactionSigner } from './transaction-signer.entity';
import { TransactionApprover } from './transaction-approver.entity';
import { Notification, NotificationPreferences } from './notifications';
import { NotificationReceiver } from './notifications/notification-receiver.entity';
import { Client } from './client.entity';

export enum UserStatus {
  NEW = 'NEW',
  RESET_PASSWORD = 'RESET_PASSWORD',
  NONE = 'NONE',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: false })
  admin: boolean;

  @Column({ default: UserStatus.NEW })
  status: UserStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => UserKey, userKey => userKey.user, { eager: true })
  keys: UserKey[];

  @OneToMany(() => TransactionSigner, transactionSigner => transactionSigner.user)
  signerForTransactions: TransactionSigner[];

  @OneToMany(() => TransactionObserver, observer => observer.user)
  observableTransactions: TransactionObserver[];

  @OneToMany(() => TransactionApprover, approver => approver.user)
  approvableTransactions: TransactionApprover[];

  @OneToMany(() => TransactionComment, comment => comment.user)
  comments: TransactionComment[];

  @OneToMany(() => Notification, notification => notification.actor)
  issuedNotifications: Notification[];

  @OneToMany(() => NotificationReceiver, notificationReceiver => notificationReceiver.notification)
  receivedNotifications: NotificationReceiver[];

  @OneToMany(() => NotificationPreferences, preferences => preferences.user)
  notificationPreferences: NotificationPreferences[];

  @OneToMany(() => Client, client => client.user)
  clients: Client[];
}
