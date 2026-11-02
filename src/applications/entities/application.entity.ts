import { 
  Entity, PrimaryGeneratedColumn, Column, 
  CreateDateColumn, ManyToOne, OneToMany 
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { ResumeVariant } from '../../resumes/entities/resume.entity';
import { ApplicationStatus } from '../enums/application-status.enum';
import { Job } from '../../job/entities/job.entity';
import { ApplicationAttempt } from '../entities/application-attempts';

@Entity('application_records')
export class ApplicationRecord {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  applicationId: string; // e.g., APP-001

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  status: ApplicationStatus;

  @CreateDateColumn({name: 'created_at'})
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  applicationDate: Date;

  // ================================================
  //   NEW AUDIT TRACKER COLUMNS
  // ================================================
  @Column({ nullable: true })
  cvUsed: string;

  @Column({ nullable: true })
  coverLetterUsed: string;

  @Column({ nullable: true })
  hours: string; // e.g., Full-time, Contract

  @Column({ nullable: true })
  platform: string; // e.g., LinkedIn, Greenhouse

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  dateLatestReply: Date;

  @Column({ nullable: true })
  weekApplied: string; // e.g., Week 4

  @Column({ nullable: true })
  interviewDates: string; // e.g., 05 Mar, 12 Mar

  @Column({ nullable: true })
  interviewStage: string; // e.g., Technical, HR Screen

  @Column({ type: 'text', nullable: true })
  feedbackReceived: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ================================================
  // RELATIONSHIPS
  // ================================================

  @ManyToOne(() => Client, (client) => client.applications)
  client: Client;

  @ManyToOne(() => ResumeVariant, (resume) => resume.applications)
  resume: ResumeVariant;

  @ManyToOne(() => Job, { nullable: true })
  job: Job;

  // One application can have multiple execution attempts
  @OneToMany(() => ApplicationAttempt, (attempt) => attempt.application, {
    cascade: true,
  })
  attempts: ApplicationAttempt[];
}