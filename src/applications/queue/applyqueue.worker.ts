import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { APPLY_QUEUE, ApplyJobData } from '../queue/queue.constants';
import { ApplicationOrchestratorService } from '../services/orchestrator';

/**
 * APPLY QUEUE WORKER (THIN)
 * ─────────────────────────────────────────────────────────────────
 * Single responsibility: dequeue a job from apply_queue and
 * hand it off to the ApplicationOrchestratorService.
 *
 * This worker intentionally contains NO business logic.
 * All routing, adapter resolution, and outcome handling
 * lives in ApplicationOrchestratorService.
 *
 * Why keep them separate:
 *   - Orchestrator can be called directly by admin retry endpoints
 *     without going through the queue
 *   - Worker stays testable in isolation — just mock the orchestrator
 *   - BullMQ retry logic (throw on failure) is separate from
 *     business outcome logic (handled gracefully in orchestrator)
 *
 * BullMQ retry behaviour:
 *   - If orchestrator returns SUCCESS / REQUIRES_REVIEW / FAILED
 *     → worker completes normally (no retry)
 *   - If orchestrator throws an unhandled exception
 *     → worker rethrows → BullMQ retries per DEFAULT_JOB_OPTIONS
 * ─────────────────────────────────────────────────────────────────
 */
@Processor(APPLY_QUEUE)
export class ApplyQueueWorker extends WorkerHost {
  private readonly logger = new Logger(ApplyQueueWorker.name);

  constructor(
    private readonly orchestrator: ApplicationOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<ApplyJobData>): Promise<void> {
    const { applicationId, attemptId, clientId, jobId, resumeId } = job.data;

    this.logger.log(
      `[apply_queue] Job ${job.id} | attempt ${job.attemptsMade + 1} | application: ${applicationId}`,
    );

    // Delegate everything to the orchestrator.
    // Orchestrator handles SUCCESS / FAILED / REQUIRES_REVIEW internally.
    // If it throws (unexpected error), BullMQ catches the rethrow and retries.
    const result = await this.orchestrator.run({
      applicationId,
      attemptId,
      clientId,
      jobId,
      resumeId,
    }); 

    this.logger.log(
      `[apply_queue] Job ${job.id} completed | status: ${result.status} | application: ${applicationId}`,
    );
  }
}