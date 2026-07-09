import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionGroupItem } from './';

export const MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH = 256;

@Entity()
export class TransactionGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  // @Column({ length: MAX_TRANSACTION_GROUP_DESCRIPTION_LENGTH })
  description: string;

  @Column({ default: false })
  atomic: boolean;

  @Column({ default: false })
  sequential: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TransactionGroupItem, groupItem => groupItem.group)
  groupItems: TransactionGroupItem[];
}
