import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('quota_pricing')
export class QuotaPricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  actionName: string;

  @Column({ type: 'int', default: 1 })
  pointCost: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;
  
}