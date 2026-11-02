import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum ReviewTaskType {
  CAPTCHA = 'CAPTCHA',
  UNKNOWN_QUESTION = 'UNKNOWN_QUESTION',
  ESSAY_REQUIRED = 'ESSAY_REQUIRED',
  APPROVAL_NEEDED = 'APPROVAL_NEEDED',
}

export enum ReviewTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

@Entity('review_tasks')
export class ReviewTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Link to the specific application attempt this review is for
  @Column({ nullable: true })
  attemptId: string;

  // Links to the overall application record
  @Column({ nullable: true })
  applicationId: string;

  // What kind of review task it is
  @Column({
    type: 'enum',
    enum: ReviewTaskType,
  })
  taskType: ReviewTaskType;

  // Payload can hold detailed info, like question text, CAPTCHA URL, essay prompt, etc.
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  // Status of the review task
  @Column({
    type: 'enum',
    enum: ReviewTaskStatus,
    default: ReviewTaskStatus.PENDING,
  })
  status: ReviewTaskStatus;

  // Does this task require manual user input? (Optional orchestration field)
  @Column({ default: false })
  requiresUserInput: boolean;

  // Staff member assigned to resolve this task
  @Column({ nullable: true })
  assignedStaffId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}