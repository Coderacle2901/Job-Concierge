import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne
} from 'typeorm';
import { ApplicationRecord } from './application.entity';

export enum AttemptMethod {
  API = 'api',
  BROWSER = 'browser',
  ASSISTED = 'assisted',
}

export enum AttemptResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  WAITING_REVIEW = 'waiting_review', // ✅ NEW
}

@Entity('application_attempts')
export class ApplicationAttempt {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ================================================
  // METHOD
  // ================================================
  @Column({
    type: 'enum',
    enum: AttemptMethod,
    default: AttemptMethod.BROWSER,
  })
  method: AttemptMethod;

  // ================================================
  // RESULT
  // ================================================
  @Column({
    type: 'enum',
    enum: AttemptResult,
    default: AttemptResult.PENDING,
  })
  result: AttemptResult;

  // ================================================
  // 🔥 NEW: STEP TRACKING
  // ================================================
  @Column({ type: 'varchar', nullable: true })
  step: string;

  @Column({name: 'next_step', type: 'varchar', nullable: true })
  nextStep: string | null;

  // ================================================
  // 🔥 NEW: METADATA (VERY IMPORTANT)
  // ================================================
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // ================================================
  // ERROR + EVIDENCE
  // ================================================
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  confirmationNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  screenshotUrl: string | null;

  @CreateDateColumn()
  attemptedAt: Date;

  // ================================================
  // RELATION
  // ================================================
  @ManyToOne(() => ApplicationRecord, (application) => application.attempts, {
    onDelete: 'CASCADE',
  })
  application: ApplicationRecord;
}