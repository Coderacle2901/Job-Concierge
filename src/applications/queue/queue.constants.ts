/**
 * QUEUE CONSTANTS & JOB DATA TYPES
 * ─────────────────────────────────────────────────────────────────
 * Central place for all queue names and job payload interfaces.
 * Import these everywhere instead of hardcoding queue name strings.
 *
 * Queue design (from PRD):
 *   apply_queue        → application execution attempts
 *   retry_queue        → failed applications eligible for retry
 *   review_queue       → applications paused for human review
 *   confirmation_queue → post-submit confirmation capture
 * ─────────────────────────────────────────────────────────────────
 */

// ─── Queue Names ───────────────────────────────────────────────────
export const APPLY_QUEUE = 'apply_queue';
export const RETRY_QUEUE = 'retry_queue';
export const REVIEW_QUEUE = 'review_queue';
export const CONFIRMATION_QUEUE = 'confirmation_queue';

// ─── Job Data: apply_queue ─────────────────────────────────────────
/**
 * Payload pushed into apply_queue when a new application is created.
 * The worker uses this to load the full application + candidate data.
 */
export interface ApplyJobData {
  applicationId: string;   // ApplicationRecord UUID
  attemptId: string;       // ApplicationAttempt UUID
  clientId: string;        // Client UUID (for candidate profile lookup)
  jobId: string;           // Job UUID
  resumeId: string;        // ResumeVariant UUID
  retryCount?: number;     // 0 on first attempt
}

// ─── Job Data: retry_queue ─────────────────────────────────────────
export interface RetryJobData extends ApplyJobData {
  retryCount: number;
  previousFailureReason: string;
  scheduledAt: string;     // ISO timestamp for when to retry
}

// ─── Job Data: review_queue ────────────────────────────────────────
export interface ReviewJobData {
  applicationId: string;
  attemptId: string;
  reviewTaskId: string;
  taskType: string;        // ReviewTaskType enum value
  payload: Record<string, any>;
}

// ─── Job Data: confirmation_queue ─────────────────────────────────
export interface ConfirmationJobData {
  applicationId: string;
  confirmationNumber?: string;
  screenshotUrl?: string;
  submittedAt: string;
}

// ─── BullMQ Default Job Options ────────────────────────────────────
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,           // 5s, 10s, 20s
  },
  removeOnComplete: {
    age: 86400,            // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800,           // Keep failed jobs for 7 days for debugging
  },
};