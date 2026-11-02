import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { GreenhouseQuestion } from '../services/greenhouse.question.service';

export enum AtsType {
    GREENHOUSE = 'greenhouse',
    LEVER = 'lever',
    WORKDAY = 'workday',
    SMARTRECRUITERS = 'smartrecruiters',
    ICIMS = 'icims',
    BROWSER = 'browser',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ nullable: false })
  title: string;
 
  @Column({ nullable: false })
  company: string;
 
  @Column({ nullable: true })
  location: string;
 
  @Column({ name: 'apply_url', nullable: false })
  applyUrl: string; 
 
  @Column({ nullable: true })
  source: string;
 
  @Column({ name: 'salary_range', nullable: true })
  salaryRange: string;
 
  @Column({ name: 'job_description', type: 'text', nullable: true })
  jobDescription: string;
 
  @Column({ name: 'date_posted', type: 'timestamp', nullable: true })
  datePosted: Date;
 
  @Column({ type: 'text', nullable: true })
  url: string;
 
  @Column({ name: 'is_manual_entry', type: 'boolean', default: false })
  isManualEntry: boolean;

  @Column({ name: 'ats_type', type: 'varchar', nullable: true, default: AtsType.BROWSER })
  atsType: string;
 
  @Column({ name: 'external_job_id', type: 'varchar', nullable: true })
  externalJobId: string | null;
 
  /**
   * QUESTIONS — JSONB column
   *
   * Stores the Greenhouse questions array fetched from:
   *   GET /v1/boards/{board_token}/jobs/{job_id}?questions=true
   *
   * Why store on the job record:
   *   - Questions are fetched once and reused across every application to this job
   *   - Avoids calling the Greenhouse API on every single application attempt
   *   - LLM mapping runs against cached questions — faster, no extra API call
   *   - Can be refreshed via POST /jobs/:id/questions/refresh if the company
   *     updates their form
   *
   * Why JSONB and not a separate table:
   *   - Questions are read-only data from an external source
   *   - They don't need to be queried individually or joined elsewhere
   *   - JSONB is ideal for structured blobs like this
   *   - A separate table would add complexity with no real benefit here
   *
   * Shape stored per question:
   * {
   *   "required": true,
   *   "label": "Are you authorized to work in the US?",
   *   "name": "question_12345678",
   *   "type": "input_text",
   *   "values": [],
   *   "description": null
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  questions: GreenhouseQuestion[] | null;
 
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}