import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { ApplicationRecord } from '../../applications/entities/application.entity';

@Entity('resumes') 
export class ResumeVariant {
  
  @PrimaryGeneratedColumn('uuid') 
  id!: string; //   Added '!'

  /**
   * We store user_id as a raw column so we can easily query it,
   * but it's linked to the 'client' relationship below.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) 
  userId!: string; //   Added '!'

  @Column({ type: 'text', nullable: true })
  fileUrl!: string; //   Added '!'

  @Column({ name: 'target_role' })
  targetRole!: string; //   Added '!'

  @Column({ name: 'ats_score', type: 'int' })
  atsScore!: number; //   Added '!'

  @Column({ name: 'used_in_apps', type: 'int', default: 0 })
  usedInApps!: number; //   Added '!'

  // Stores AI-extracted keywords for ATS matching
  @Column('text', { array: true, nullable: true })
  keywords!: string[]; //   Added '!'

  /**
   * JSONB is perfect here. It stores the full tailored resume structure 
   * (personalInfo, experience, education, etc.) as a searchable, editable object.
   */
  @Column({ type: 'jsonb', nullable: true })
  content!: any; //   Added '!'

  // RELATIONSHIPS
  // Many resumes can belong to one client (Sarah can have different versions for different roles)
  @ManyToOne(() => Client, (client) => client.resumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) 
  client!: Client; 

  // One resume variant can be used in multiple applications
  @OneToMany(() => ApplicationRecord, (app) => app.resume)
  applications!: ApplicationRecord[]; //   Added '!'
}