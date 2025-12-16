import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.clients)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column()
  version: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
