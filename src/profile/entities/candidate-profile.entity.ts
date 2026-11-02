import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity('candidate_profiles')
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;  

  //   The crucial link back to the auth table
  @OneToOne(() => Client, (client) => client.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' }) 
  client!: Client;  

  // ==========================================
  //   FIGMA PREFERENCES & METADATA
  // ==========================================
  @Column({ nullable: true })
  currentRole!: string;  

  @Column({ nullable: true })
  targetRole!: string;  

  @Column({ nullable: true })
  summary!: string;  


  @Column({ default: 'Technology', nullable: true })
  industry!: string;  

  @Column({ default: '0-2', nullable: true })
  experienceYears!: string;  

  @Column({ default: 'Hybrid', nullable: true })
  remotePreference!: string;  

  @Column({ nullable: true })
  minSalary!: string;  

  @Column({ default: 'flexible', nullable: true })
  startDate!: string;  

  @Column({ nullable: true })
  portfolio!: string;  

  //   NEW: COMPLIANCE & AUTHORIZATION
  @Column({ nullable: true })
  workAuthorization!: string;  
 
  @Column({ type: 'boolean', default: false, nullable: true })
  requiresSponsorship!: boolean;  

  // ==========================================
  //   ATS MASTER PROFILE DATA
  // ==========================================
  @Column({ nullable: true })
  phone!: string;  

  @Column({ nullable: true })
  resumeUrl!: string;  

  @Column({ nullable: true })
  location!: string;  

  @Column({ nullable: true })
  linkedin!: string;  

  @Column({ nullable: true })
  github!: string;  

  @Column("text", { array: true, nullable: true })
  skills!: string[];  
  
  @Column({ type: 'jsonb', nullable: true })
  experience!: any;  

  @Column({ type: 'jsonb', nullable: true })
  education!: any;  

  @Column({ type: 'jsonb', nullable: true })
  projects!: any;  

  @Column("text", { array: true, nullable: true })
  certifications!: string[];  

  @Column({ type: 'boolean', default: false, nullable: true })
  remoteOnly!: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  willingToRelocate!: boolean;

  @Column({ type: 'boolean', default: true, nullable: true })
  openToOnsiteRoles!: boolean;

  @Column({ nullable: true })
  noticePeriod!: string; // e.g., "2 weeks"

  @Column({ type: 'numeric', nullable: true })
  currentSalary!: number;

  @Column("text", { array: true, nullable: true })
  preferredTools!: string[]; // e.g., ["GitHub Copilot", "Cursor"]

  @Column({ nullable: true })
  employmentStatus!: string;

  @Column("text", { array: true, nullable: true })
  preferredLocations!: string[];
  
} 