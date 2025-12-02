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
import { NotificationReceiver } from '@app/common/database/entities';

export enum NotificationType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_WAITING_FOR_SIGNATURES = 'TRANSACTION_WAITING_FOR_SIGNATURES',
  TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER = 'TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER',
  TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL = 'TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL',
  TRANSACTION_READY_FOR_EXECUTION = 'TRANSACTION_READY_FOR_EXECUTION',
  TRANSACTION_EXECUTED = 'TRANSACTION_EXECUTED',
  TRANSACTION_EXPIRED = 'TRANSACTION_EXPIRED',
  TRANSACTION_CANCELLED = 'TRANSACTION_CANCELLED',
  TRANSACTION_APPROVED = 'TRANSACTION_APPROVED',
  TRANSACTION_APPROVAL_REJECTION = 'TRANSACTION_APPROVAL_REJECTION',
  TRANSACTION_INDICATOR_APPROVE = 'TRANSACTION_INDICATOR_APPROVE',
  TRANSACTION_INDICATOR_REJECTED = 'TRANSACTION_INDICATOR_REJECTED',
  TRANSACTION_INDICATOR_SIGN = 'TRANSACTION_INDICATOR_SIGN',
  TRANSACTION_INDICATOR_EXECUTABLE = 'TRANSACTION_INDICATOR_EXECUTABLE',
  TRANSACTION_INDICATOR_EXECUTED = 'TRANSACTION_INDICATOR_EXECUTED',
  TRANSACTION_INDICATOR_FAILED = 'TRANSACTION_INDICATOR_FAILED',
  TRANSACTION_INDICATOR_CANCELLED = 'TRANSACTION_INDICATOR_CANCELLED',
  TRANSACTION_INDICATOR_EXPIRED = 'TRANSACTION_INDICATOR_EXPIRED',
  TRANSACTION_INDICATOR_ARCHIVED = 'TRANSACTION_INDICATOR_ARCHIVED',
  USER_REGISTERED = 'USER_REGISTERED',
}

export const NOTIFICATION_CHANNELS: Record<NotificationType, {
  email: boolean;
  inApp: boolean;
}> = {
  // Indicator types - UI notification center only, deletable when status changes
  [NotificationType.TRANSACTION_INDICATOR_APPROVE]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_REJECTED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_SIGN]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_EXECUTABLE]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_EXECUTED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_FAILED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_CANCELLED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_EXPIRED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.TRANSACTION_INDICATOR_ARCHIVED]: {
    email: false,
    inApp: true,
  },
  [NotificationType.USER_REGISTERED]: {
    email: false,
    inApp: true,
  },

  // Regular types - Email/informational, not UI indicators
  [NotificationType.TRANSACTION_CREATED]: {
    email: true,
    inApp: false,
  },
  [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES]: {
    email: true,
    inApp: false,
  },
  //This only sends a reminder email, it will reset in app notifications
  [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER]: {
    email: true,
    inApp: false,
  },
  //This one is being phased out, instead it resets the last notification sent
  [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL]: {
    email: false,
    inApp: false,
  },
  [NotificationType.TRANSACTION_READY_FOR_EXECUTION]: {
    email: true,
    inApp: false,
  },
  [NotificationType.TRANSACTION_EXECUTED]: {
    email: true,
    inApp: false,
  },
  [NotificationType.TRANSACTION_EXPIRED]: {
    email: true,
    inApp: false,
  },
  [NotificationType.TRANSACTION_CANCELLED]: {
    email: true,
    inApp: false,
  },

  // Approval notifications - may be required in the future
  [NotificationType.TRANSACTION_APPROVED]: {
    email: false,
    inApp: false,
  },
  [NotificationType.TRANSACTION_APPROVAL_REJECTION]: {
    email: false,
    inApp: false,
  },
};

export type NotificationAdditionalData = Record<string, any>;

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: NotificationType;

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
  'entityId',
  'actorId',
  'createdAt',
];

export const notificationDateProperties: (keyof Notification)[] = ['createdAt'];
