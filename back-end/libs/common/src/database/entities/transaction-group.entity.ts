import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionGroupItem } from './';

@Entity()
export class TransactionGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column({ default: false })
  atomic: boolean;

  @Column({ default: false })
  sequential: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  groupValidStart: Date;

  @OneToMany(() => TransactionGroupItem, groupItem => groupItem.group)
  groupItems: TransactionGroupItem[];
}
