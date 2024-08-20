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
  TRANSCATION_EXECUTED = 'TRANSCATION_EXECUTED',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: NotificationType;

  @Column()
  content: string;

  @Column()
  entityId?: number;

  @ManyToOne(() => User, user => user.issuedNotifications)
  @JoinColumn({ name: 'actorId' })
  actor?: User;

  @Column()
  actorId?: number;

  @Column({ default: false })
  isEmailSent?: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => NotificationReceiver, notificationReceiver => notificationReceiver.notification)
  notificationReceivers: NotificationReceiver[];
}
