import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionGroupItem } from './';

@Entity()
export class TransactionGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column({ default: false})
  atomic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TransactionGroupItem, groupItem => groupItem.group)
  groupItems: TransactionGroupItem[];
}