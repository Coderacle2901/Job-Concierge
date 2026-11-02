import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../../clients/entities/client.entity';
import { Admin } from '../../entities/admin.entity';

@Entity('base_resumes')
export class BaseResume {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'resume_name' })
    resumeName: string;
    // Human-readable name for this resume variant.
    // e.g. "Tech Focus v1", "Management Focus v2"
    // Staff and admins use this to identify which base resume to use
    // when optimizing for a specific job type.

    @Column({ type: 'jsonb', name: 'resume_json' })
    resumeJson: Record<string, any>;
    // The full Atomic JSON structure stored as jsonb in Postgres.
    // jsonb is preferred over json in Postgres because:
    // - it's stored in a decomposed binary format (faster to query)
    // - supports indexing on nested fields
    // - allows Postgres operators like @> for containment checks
    // Every section, text node, bullet point and formatting object
    // lives inside this single column.

    @Column({
        name: 'ats_baseline_score',
        type: 'float',
        nullable: true,
    })
    atsBaselineScore: number | null;
    // ATS score calculated after the resume is saved.
    // Nullable because it's computed asynchronously after creation —
    // the resume is saved first, then the score is calculated and
    // updated in a second operation.
    // Target baseline for a usable base resume is >= 75 per the spec.

    @Column({ name: 'version', default: 1 })
    version: number;
    // Increments each time this specific resume record is edited.
    // Not the same as creating a duplicate — this tracks edit history
    // on the same record. Duplicates create a new record entirely.

@Column({ name: 'parent_resume_id', type: 'uuid', nullable: true })
parentResumeId: string | null;
    // Set when this resume was duplicated from another.
    // Null means this is an original base resume created from scratch
    // or from a parsed PDF.
    // When set, it points to the id of the resume it was cloned from.
    // This creates the version chain:
    // Base v1 (parentResumeId: null)
    //   └─ Tech Focus v2 (parentResumeId: Base v1 id)
    //       └─ Remote Focus v3 (parentResumeId: Tech Focus v2 id)

    @Column({ name: 'is_active', default: true })
    isActive: boolean;
    // Soft delete flag. Inactive resumes are hidden from staff
    // but preserved in the database for audit and history purposes.

    // ─── RELATIONSHIPS ─────────────────────────────────────────────────────────

    @ManyToOne(() => Client, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'client_id' })
    client: Client;
    // Every base resume belongs to exactly one client.
    // onDelete: CASCADE means if a client is deleted, all their
    // base resumes are deleted too. No orphaned resume records.

    @ManyToOne(() => Admin, { nullable: false })
    @JoinColumn({ name: 'created_by' })
    createdBy: Admin;
    // The admin who created this base resume.
    // Used in the audit trail and dashboard to track who built what.
    // Staff cannot create base resumes — only admins can.

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}