import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user.entity';
import { NotificationType } from './notification.entity';

@Entity()
export class NotificationPreferences {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column()
  type: NotificationType;

  @Column({ default: true })
  email: boolean;

  @Column({ default: true })
  inApp: boolean;
}

export type NotificationPreferencesOptions = Omit<
  NotificationPreferences,
  'id' | 'user' | 'userId'
>;
