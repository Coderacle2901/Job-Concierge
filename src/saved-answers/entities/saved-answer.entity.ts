import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

/**
 * SAVED ANSWERS ENTITY
 * ─────────────────────────────────────────────────────────────────
 * Caches answers to recurring application questions per client.
 *
 * How it fits into the flow:
 *   1. LlmMappingService checks SavedAnswers before calling Claude
 *   2. Known questions are answered from cache — no LLM call needed
 *   3. When a human resolves a Route C question, the answer is saved here
 *   4. Next time the same question appears, it's answered automatically
 *
 * The `questionName` field uses the ATS field name (e.g. "question_12345678")
 * but we also store `questionLabel` so staff can understand what it means
 * in the review UI.
 *
 * `atsType` scopes answers to a specific ATS — a Greenhouse answer
 * format may not work on Lever.
 * ─────────────────────────────────────────────────────────────────
 */
@Entity('saved_answers')
@Index(['client', 'questionName', 'atsType'], { unique: true })
export class SavedAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The ATS field name — used as the lookup key
  // e.g. "question_12345678" for Greenhouse
  @Column({ name: 'question_name' })
  questionName: string;

  // Human-readable label — for display in review UI
  // e.g. "Are you authorized to work in the US?"
  @Column({ name: 'question_label', type: 'text' })
  questionLabel: string;

  // The approved answer
  @Column({ type: 'text' })
  answer: string;

  // Scoped to ATS type — answers may vary between platforms
  @Column({ name: 'ats_type', default: 'greenhouse' })
  atsType: string;

  // Whether this was set by the user directly or resolved from a review task
  @Column({ name: 'source', default: 'user' })
  source: 'user' | 'review_resolution' | 'llm_confirmed';

  // How many times this saved answer has been used
  @Column({ name: 'use_count', default: 0 })
  useCount: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  client: Client;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}