import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../user.entity';

@Entity()
export class NotificationReceiver {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Notification, notification => notification.notificationReceivers)
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column()
  notificationId: number;

  @ManyToOne(() => User, user => user.receivedNotifications)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: false })
  isRead: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const notificationReceiverProperties: (keyof NotificationReceiver)[] = [
  'id',
  'notificationId',
  'userId',
  'isRead',
  'updatedAt',
];

export const notificationReceiverDateProperties: (keyof NotificationReceiver)[] = ['updatedAt'];
