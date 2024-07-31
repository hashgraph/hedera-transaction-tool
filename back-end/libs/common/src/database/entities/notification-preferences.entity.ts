import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class NotificationPreferences {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: true })
  transactionRequiredSignature: boolean;

  @Column({ default: true })
  transactionReadyForExecution: boolean;
}

export type NotificationPreferencesOptions = Omit<
  NotificationPreferences,
  'id' | 'user' | 'userId'
>;
