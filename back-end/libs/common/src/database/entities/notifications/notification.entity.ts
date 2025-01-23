import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user.entity';
import { NotificationReceiver } from './notification-receiver.entity';

export enum NotificationType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_WAITING_FOR_SIGNATURES = 'TRANSACTION_WAITING_FOR_SIGNATURES',
  TRANSACTION_READY_FOR_EXECUTION = 'TRANSACTION_READY_FOR_EXECUTION',
  TRANSACTION_EXECUTED = 'TRANSACTION_EXECUTED',
  TRANSACTION_EXPIRED = 'TRANSACTION_EXPIRED',
  TRANSACTION_CANCELLED = 'TRANSACTION_CANCELLED',
  TRANSACTION_INDICATOR_APPROVE = 'TRANSACTION_INDICATOR_APPROVE',
  TRANSACTION_INDICATOR_SIGN = 'TRANSACTION_INDICATOR_SIGN',
  TRANSACTION_INDICATOR_EXECUTABLE = 'TRANSACTION_INDICATOR_EXECUTABLE',
  TRANSACTION_INDICATOR_EXECUTED = 'TRANSACTION_INDICATOR_EXECUTED',
  TRANSACTION_INDICATOR_EXPIRED = 'TRANSACTION_INDICATOR_EXPIRED',
  TRANSACTION_INDICATOR_ARCHIVED = 'TRANSACTION_INDICATOR_ARCHIVED',
}

export type NotificationAdditionalData = {
  network: string;
};

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: NotificationType;

  @Column()
  content: string;

  @Column({ nullable: true })
  entityId?: number;

  @Column({ type: 'json', nullable: true, default: {} })
  additionalData?: NotificationAdditionalData;

  @ManyToOne(() => User, user => user.issuedNotifications)
  @JoinColumn({ name: 'actorId' })
  actor?: User;

  @Column({ nullable: true })
  actorId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => NotificationReceiver, notificationReceiver => notificationReceiver.notification)
  notificationReceivers: NotificationReceiver[];
}

export const notificationProperties: (keyof Notification)[] = [
  'id',
  'type',
  'content',
  'entityId',
  'actorId',
  'createdAt',
];

export const notificationDateProperties: (keyof Notification)[] = ['createdAt'];
