import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Any, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Job } from '../entities/job.entity';

/**
 * GREENHOUSE QUESTION SHAPE
 * Returned inside the questions array when fetching a job with ?questions=true
 *
 * {
 *   "required": true,
 *   "label": "Are you legally authorized to work in the United States?",
 *   "name": "question_12345678",
 *   "type": "input_text",              // See types below
 *   "values": [],                      // Populated for select/dropdown types
 *   "description": null
 * }
 *
 * Possible types:
 *   "input_text"               → single line text input
 *   "textarea"                 → multi-line text
 *   "input_file"               → file upload (resume, cover letter, portfolio)
 *   "select"                   → single choice dropdown
 *   "multi_value_single_select"→ radio buttons (pick one)
 *   "multi_value_multi_select" → checkboxes (pick many)
 *   "boolean"                  → yes/no radio
 */
export interface GreenhouseQuestion {
  required: boolean;
  label: string;
  name: string;
  type: string;
  values: Array<{ value: number; label: string }>;
  description: string | null;
}

@Injectable()
export class GreenhouseQuestionsService {
  private readonly logger = new Logger(GreenhouseQuestionsService.name);
  private readonly API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

  constructor(
    private readonly httpService: HttpService,

    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  /**
   * FETCH AND CACHE QUESTIONS FOR A JOB
   *
   * Fetches the questions array from Greenhouse for a specific job
   * and stores it in the job's `questions` JSONB column.
   *
   * Called by:
   *   - GreenhouseAdapter before automation starts (pre-flight)
   *   - Job ingestion service when storing a new job (optional enrichment)
   *   - Admin endpoint to refresh questions for a stored job
   *
   * @param jobId - Our internal Job UUID
   */
  async fetchAndCacheForJob(jobId: string): Promise<GreenhouseQuestion[]> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (!job.externalJobId) {
      throw new Error(`Job ${jobId} has no externalJobId — cannot fetch Greenhouse questions`);
    }

    // Extract board token from source field (stored as "greenhouse:boardtoken")
    const boardToken = this.extractBoardToken(job.source, job.applyUrl);

    if (!boardToken) {
      throw new Error(`Cannot resolve board token for job ${jobId}`);
    }

    const questions = await this.fetchQuestions(boardToken, job.externalJobId);

    // Cache on the job record so we don't re-fetch every application
    await this.jobRepo.update(jobId, { questions });

    this.logger.log(
      `Cached ${questions.length} questions for job ${jobId} (${job.title})`,
    );

    return questions;
  }

  /**
   * GET QUESTIONS FOR JOB
   *
   * Returns cached questions if available, fetches and caches if not.
   * This is what GreenhouseAdapter calls before automation.
   *
   * @param jobId - Our internal Job UUID
   */
  async getQuestionsForJob(jobId: string): Promise<GreenhouseQuestion[]> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Return cached if available
    if (job.questions && Array.isArray(job.questions) && job.questions.length > 0) {
      this.logger.debug(`Returning cached questions for job ${jobId} (${job.questions.length} questions)`);
      return job.questions as GreenhouseQuestion[];
    }

    // Fetch, cache, and return
    return this.fetchAndCacheForJob(jobId);
  }

  /**
   * FETCH QUESTIONS DIRECTLY BY BOARD TOKEN AND EXTERNAL JOB ID
   * Used by GreenhouseAdapter when it already has this info
   * without needing to load the Job entity again.
   */
  async fetchQuestions(
    boardToken: string,
    externalJobId: string,
  ): Promise<GreenhouseQuestion[]> {
    const url = `${this.API_BASE}/${boardToken}/jobs/${externalJobId}?questions=true`;

    this.logger.log(`Fetching questions: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'JobConcierge/1.0',
            'Accept': 'application/json',
          },
        }),
      );

      const questions: GreenhouseQuestion[] = response.data?.questions ?? [];
      this.logger.log(`Fetched ${questions.length} questions for job ${externalJobId}`);
      return questions;

    } catch (err: any) {
      this.logger.error(`Failed to fetch questions for ${externalJobId}: ${err.message}`);
      return []; // Return empty — orchestrator falls back to generic form filling
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private extractBoardToken(source: string | null, applyUrl: string): string | null {
    // Try from source field first — stored as "greenhouse:boardtoken"
    if (source?.startsWith('greenhouse:')) {
      return source.split(':')[1];
    }

    // Fall back to parsing the apply URL
    // https://boards.greenhouse.io/acme/jobs/123 → acme
    const match = applyUrl?.match(/greenhouse\.io\/([^\/]+)\/jobs/);
    return match?.[1] ?? null;
  }
}