import {
  Controller, Get, Post, Param, Query,
  Body, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JobsService } from '../services/job.service';
import { JobIngestionOrchestrator } from '../services/job.ingestion.service';
import { GreenhouseQuestionsService } from '../services/greenhouse.question.service';

// ── DTOs ──────────────────────────────────────────────────────────

class FetchGreenhouseDto {
  boardToken: string;   // e.g. 'acme' from boards.greenhouse.io/acme
  company: string;      // Human-readable company name
  fetchDetail?: boolean; // Whether to fetch full description (default: true)
}

class FetchGreenhouseBulkDto {
  boards: Array<{ boardToken: string; company: string }>;
}

/**
 * JOBS CONTROLLER
 * ─────────────────────────────────────────────────────────────────
 *
 * Existing endpoints:
 *   GET  /jobs              → all jobs in the database
 *   GET  /jobs/:id          → single job by ID
 *
 * New ingestion endpoints:
 *   POST /jobs/ingest/greenhouse          → fetch + store from one Greenhouse board
 *   POST /jobs/ingest/greenhouse/bulk     → fetch + store from multiple boards
 *   GET  /jobs/:id/questions              → get cached questions for a job
 *   POST /jobs/:id/questions/refresh      → re-fetch + cache questions from Greenhouse
 * ─────────────────────────────────────────────────────────────────
 */
@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly ingestionOrchestrator: JobIngestionOrchestrator,
    private readonly greenhouseQuestionsService: GreenhouseQuestionsService,
  ) {}

  // ─────────────────────────────────────────────
  // EXISTING — GET /jobs
  // ─────────────────────────────────────────────
  @Get()
  async getAllJobs() {
    this.logger.log('Fetching all jobs');
    return this.jobsService.getAllJobs();
  }

  // ─────────────────────────────────────────────
  // NEW — POST /jobs/ingest/greenhouse
  //
  // Trigger ingestion from a single Greenhouse board.
  // Fetches all live jobs, deduplicates, stores new ones.
  //
  // Body: { boardToken: "acme", company: "Acme Corp", fetchDetail: true }
  //
  // Response: { created, skipped, failed, total }
  // ─────────────────────────────────────────────
  @Post('ingest/greenhouse')
  @HttpCode(HttpStatus.OK)
  async ingestFromGreenhouse(@Body() dto: FetchGreenhouseDto) {
    this.logger.log(
      `POST /jobs/ingest/greenhouse — board: ${dto.boardToken} | company: ${dto.company}`,
    );
    return this.ingestionOrchestrator.fetchFromGreenhouse(
      dto.boardToken,
      dto.company,
      dto.fetchDetail ?? true,
    );
  }

  // ─────────────────────────────────────────────
  // NEW — POST /jobs/ingest/greenhouse/bulk
  //
  // Trigger ingestion from multiple Greenhouse boards.
  //
  // Body: {
  //   boards: [
  //     { boardToken: "acme", company: "Acme Corp" },
  //     { boardToken: "globex", company: "Globex Corporation" }
  //   ]
  // }
  // ─────────────────────────────────────────────
  @Post('ingest/greenhouse/bulk')
  @HttpCode(HttpStatus.OK)
  async ingestFromGreenhouseBulk(@Body() dto: FetchGreenhouseBulkDto) {
    this.logger.log(
      `POST /jobs/ingest/greenhouse/bulk — ${dto.boards.length} boards`,
    );
    return this.ingestionOrchestrator.fetchFromGreenhouseBulk(dto.boards);
  }

  // ─────────────────────────────────────────────
  // NEW — GET /jobs/:id/questions
  //
  // Returns cached questions for a job.
  // If not cached, fetches from Greenhouse and caches automatically.
  // Used by the LLM mapping service before automation starts.
  //
  // Example: GET /jobs/abc-123/questions
  // ─────────────────────────────────────────────
  @Get(':id/questions')
  async getJobQuestions(@Param('id') id: string) {
    this.logger.log(`GET /jobs/${id}/questions`);
    const questions = await this.greenhouseQuestionsService.getQuestionsForJob(id);
    return { jobId: id, total: questions.length, questions };
  }

  // ─────────────────────────────────────────────
  // NEW — POST /jobs/:id/questions/refresh
  //
  // Force re-fetch questions from Greenhouse and update cache.
  // Useful when a company updates their application form.
  //
  // Example: POST /jobs/abc-123/questions/refresh
  // ─────────────────────────────────────────────
  @Post(':id/questions/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshJobQuestions(@Param('id') id: string) {
    this.logger.log(`POST /jobs/${id}/questions/refresh`);
    const questions = await this.greenhouseQuestionsService.fetchAndCacheForJob(id);
    return {
      jobId: id,
      message: 'Questions refreshed and cached',
      total: questions.length,
      questions,
    };
  }

  // ─────────────────────────────────────────────
  // EXISTING — GET /jobs/:id
  // Must be last — catches any :id that didn't match above routes
  // ─────────────────────────────────────────────
  @Get(':id')
  async getJobById(@Param('id') id: string) {
    this.logger.log(`Fetching job: ${id}`);
    return this.jobsService.getJobById(id);
  }
}