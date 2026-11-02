import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Staff } from './staff.entity';
import { Client } from '../../clients/entities/client.entity';
import { BaseResume } from '../../admin/resume/entities/base-resume.entity';

export enum AssignmentStatus {
  ACTIVE = 'ACTIVE',
  // Currently within deadline, work in progress

  COMPLETE = 'COMPLETE',
  // Target applications achieved within deadline

  OVERDUE = 'OVERDUE',
  // Deadline passed without meeting application target

  PAUSED = 'PAUSED',
  // Temporarily paused — client requested pause or admin intervened
}

@Entity('staff_assignments')
export class StaffAssignment {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @Column({ 
    name: 'target_applications', 
    type: 'int',
    default: 0, 
    nullable: false 
  })
  targetApplications: number;
  // Monthly application target set by admin.
  // e.g. 25 means staff must submit 25 applications for this client
  // within the assignment period.

  @Column({ name: 'completed_applications', type: 'int', default: 0 })
  completedApplications: number;
  // Tracks how many applications have been submitted so far.
  // Incremented each time a job application is marked as submitted.
  // Used to calculate progress percentage on the dashboard.

  @Column({ name: 'start_date', type: 'date', nullable: true, default: null })
  startDate: Date;;
  // Assignment start date — usually the first day of the month.

  @Column({ name: 'end_date', type: 'date', nullable: true, default: null })
  endDate: Date | null;
  // Assignment end date — usually the last day of the month.
  // Used to determine if assignment is OVERDUE.

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
  // Optional admin notes about this assignment.
  // e.g. "Client prefers remote roles only"

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── RELATIONSHIPS ──────────────────────────────────────────────────────────

  @ManyToOne(() => Staff, (staff) => staff.assignments, { nullable: false })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;
  // The staff member assigned to this client.
  // One staff handles one client at a time per assignment.

  @ManyToOne(() => Client, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' }) 
  client: Client;
  // The client being serviced in this assignment.
  // CASCADE means if client is deleted, their assignments are too.

  @ManyToOne(() => BaseResume, { nullable: true })
  @JoinColumn({ name: 'baseResumeId' })
  baseResume: BaseResume | null;
  // The base resume variant staff should use for this assignment.
  // Nullable — admin may not have created a base resume yet
  // when the assignment is first created.
}