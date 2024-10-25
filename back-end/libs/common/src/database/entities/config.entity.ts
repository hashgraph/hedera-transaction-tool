import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Config {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  setupCompleted: boolean;
}