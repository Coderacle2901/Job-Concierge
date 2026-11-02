import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BaseResume } from '../resume/entities/base-resume.entity';

@Entity('admins')
export class Admin {

  @PrimaryColumn('uuid')
  id: string;
  // PrimaryColumn NOT PrimaryGeneratedColumn — because the UUID comes
  // from Supabase Auth, not from us. We never generate this id ourselves.

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName: string | null;
;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName: string | null;
 

  @Column({ unique: true })
  email: string;
  // Mirrors the email in Supabase Auth. Kept here so we can
  // query admins by email without hitting Supabase Auth API.

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  // Soft deactivation flag. When false, Tony's login still
  // authenticates them via Supabase Auth BUT we can add a guard
  // in the admin routes that checks this flag and blocks access.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  
  @OneToMany(() => BaseResume, (resume) => resume.createdBy)
  resumes: BaseResume[];
  // All base resumes created by this admin.
  // Used in the dashboard to track admin productivity —
  // how many resumes each admin has built across all clients.
}
  
