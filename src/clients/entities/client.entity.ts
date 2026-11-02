import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne } from 'typeorm';
import { ApplicationRecord } from '../../applications/entities/application.entity';
import { ResumeVariant } from '../../resumes/entities/resume.entity';
import { CandidateProfile } from '../../profile/entities/candidate-profile.entity'; 

export enum ApplyMode {
  FULL_AUTO = 'full_auto',
  REVIEW_BEFORE_SUBMIT = 'review_before_submit',
  CONCIERGE = 'concierge',
}

//   NEW: Define the exact states from the workflow document
export enum ClientStatus {
  INCOMPLETE = 'INCOMPLETE',
  REJECTED = 'REJECTED',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED'
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ nullable: true })
  name: string;

  //   MOVED HERE: Core Identity Fields
  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ default: 'customer' })
  role: string; 

  //   NEW: The status column tracking their Concierge journey
  @Column({ 
    type: 'enum', 
    enum: ClientStatus, 
    default: ClientStatus.INCOMPLETE 
  })
  status: ClientStatus;

  @Column({ nullable: true })
  planName: string;

  @Column({ type: 'int', default: 200 })
  totalQuota: number;

  @Column({ type: 'int', default: 200 })
  remainingQuota: number;

  @Column({ name: 'applyMode', nullable: true, default: ApplyMode.FULL_AUTO })
  applyMode: string;

  @Column({ 
    name: 'has_completed_intake', 
    type: 'boolean', 
    default: false 
  })
  hasCompletedIntake: boolean;


  // ==========================================
  //   RELATIONSHIPS (Strict PRD Architecture)
  // ==========================================

  // 1-to-1 link to the massive ATS profile
  @OneToOne(() => CandidateProfile, (profile) => profile.client, { cascade: true })
  profile: CandidateProfile;

  @OneToMany(() => ApplicationRecord, (app) => app.client)
  applications: ApplicationRecord[];

  @OneToMany(() => ResumeVariant, (resume) => resume.client)
  resumes: ResumeVariant[];

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;
}