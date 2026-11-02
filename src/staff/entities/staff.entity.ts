import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { StaffAssignment } from './staff-assignment.entity';

@Entity('staff')
export class Staff {

  @PrimaryColumn('uuid')
  id: string;
  // UUID sourced from Supabase Auth — same pattern as Admin entity.
  // Must match the id in Supabase Auth so Tony's login can
  // resolve role: 'staff' via the staff table lookup.

 @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', default: 'staff' })
  role: string;

  @Column({ type: 'text', nullable: true })
  department: string;
  // Optional department classification e.g. "Resume Team", "Applications Team"
  // Useful for dashboard filtering when team grows.

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
  // Soft deactivation — admin can deactivate staff without deleting.
  // Deactivated staff are hidden from new assignment options
  // but their existing assignment history is preserved.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ─── RELATIONSHIPS ──────────────────────────────────────────────────────────

  @OneToMany(() => StaffAssignment, (assignment) => assignment.staff)
  assignments: StaffAssignment[];
  // All assignments this staff member has ever had.
  // Used in the dashboard to calculate workload and performance metrics.
}