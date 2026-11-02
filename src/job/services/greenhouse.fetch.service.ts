import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Job } from '../entities/job.entity';
import { AtsType } from '../entities/job.entity';
import {decode} from 'html-entities';

/**
 * RAW GREENHOUSE API RESPONSE SHAPE
 * ─────────────────────────────────────────────────────────────────
 * GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
 *
 * Returns:
 * {
 *   "jobs": [ 
 *     { 
 *       "id": 4058338007,
 *       "title": "Senior Software Engineer",
 *       "updated_at": "2024-01-15T10:30:00-05:00",
 *       "requisition_id": "REQ-123",
 *       "location": {
 *         "name": "New York, NY"
 *       }, 
 *       "metadata": [],  
 *       "absolute_url": "https://boards.greenhouse.io/acme/jobs/4058338007",
 *       "internal_job_id": 1234567,
 *       "departments": [
 *         { "id": 1, "name": "Engineering", "parent_id": null, "parent_name": null, "child_ids": [] }
 *       ],
 *       "offices": [
 *         { "id": 1, "name": "New York", "location": "New York, NY", "primary_contact_user_id": 1, "parent_id": null, "parent_name": null, "child_ids": [], "child_office_ids": [] }
 *       ]
 *     }
 *   ],
 *   "meta": {
 *     "total": 42
 *   }
 * }
 *
 * NOTE: The basic /jobs endpoint does NOT include job description or salary.
 * To get the full description you must call:
 *   GET /v1/boards/{board_token}/jobs/{job_id}
 * which returns the full job object including "content" (HTML description)
 * and "questions" array.
 *
 * We fetch the list first, then optionally enrich with full detail per job.
 * ─────────────────────────────────────────────────────────────────
 */

export interface GreenhouseJobRaw {
  id: number;
  title: string;
  updated_at: string;
  requisition_id: string | null;
  location: { name: string } | null;
  metadata: any[];
  absolute_url: string;
  internal_job_id: number;
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string; location: string }>;
  // Present only when fetching individual job detail
  content?: string;       // HTML job description
  questions?: any[];      // Form questions array
}

export interface GreenhouseJobsResponse {
  jobs: GreenhouseJobRaw[];
  meta: { total: number };
}

export interface GreenhouseFetchResult {
  company: string;
  boardToken: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class GreenhouseFetchService {
  private readonly logger = new Logger(GreenhouseFetchService.name);
  private readonly API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

  // Rate limiting — pause between requests to avoid being blocked
  private readonly DELAY_BETWEEN_REQUESTS_MS = 1200;
  private readonly DELAY_BETWEEN_DETAIL_REQUESTS_MS = 800;

  constructor(
  private readonly httpService: HttpService,

    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  /**
   * MAIN METHOD — fetch all jobs for a company board token
   *
   * @param boardToken  - Greenhouse board token e.g. 'acme' from boards.greenhouse.io/acme
   * @param company     - Company name to store on job record
   * @param fetchDetail - If true, fetches full job description per job (slower, more data)
   */
  async fetchAndStore(
    boardToken: string,
    company: string,
    fetchDetail: boolean = true,
  ): Promise<GreenhouseFetchResult> {
    this.logger.log(`Starting Greenhouse fetch — board: ${boardToken} | company: ${company}`);

    const result: GreenhouseFetchResult = {
      company,
      boardToken,
      total: 0,
      created: 0,
      skipped: 0,
      failed: 0,
    };

    // ── Step 1: Fetch job listing ──
    let jobs: GreenhouseJobRaw[] = [];
    try {
      jobs = await this.fetchJobList(boardToken);
      result.total = jobs.length;
      this.logger.log(`Fetched ${jobs.length} jobs from Greenhouse board: ${boardToken}`);
    } catch (err: any) {
      this.logger.error(`Failed to fetch job list for ${boardToken}: ${err.message}`);
      throw err;
    }

    // ── Step 2: Process each job ──
    for (const rawJob of jobs) {
      try {
        // Deduplication — check by externalJobId + atsType
        const exists = await this.jobRepo.findOne({
          where: {
            externalJobId: String(rawJob.id),
            atsType: AtsType.GREENHOUSE,
          },
        });

        if (exists) {
          this.logger.debug(`Skipping duplicate — externalJobId: ${rawJob.id} (${rawJob.title})`);
          result.skipped++;
          continue;
        }

        // ── Step 3: Optionally fetch full detail (description + questions) ──
        let fullJob: GreenhouseJobRaw = rawJob;
        if (fetchDetail) {
          await this.sleep(this.DELAY_BETWEEN_DETAIL_REQUESTS_MS);
          fullJob = await this.fetchJobDetail(boardToken, rawJob.id);
        }

        // ── Step 4: Map to Job entity and save ──
        const jobEntity = this.mapToEntity(fullJob, company, boardToken);
        await this.jobRepo.save(jobEntity);

        this.logger.debug(`Saved: ${rawJob.title} [${rawJob.id}]`);
        result.created++;

        // Rate limit between saves
        await this.sleep(this.DELAY_BETWEEN_REQUESTS_MS);

      } catch (err: any) {
        this.logger.error(`Failed to process job ${rawJob.id}: ${err.message}`);
        result.failed++;
      }
    }

    this.logger.log(
      `Greenhouse fetch complete — ${result.created} created | ${result.skipped} skipped | ${result.failed} failed`,
    );

    return result;
  }

  /**
   * FETCH JOB LIST
   * GET /v1/boards/{board_token}/jobs
   * Returns basic job listing without description or questions.
   */
  private async fetchJobList(boardToken: string): Promise<GreenhouseJobRaw[]> {
    const url = `${this.API_BASE}/${boardToken}/jobs`;

    const response = await firstValueFrom(
      this.httpService.get<GreenhouseJobsResponse>(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'JobConcierge/1.0',
          'Accept': 'application/json',
        },
      }),
    );

    return response.data?.jobs ?? [];
  }

  /**
   * FETCH JOB DETAIL
   * GET /v1/boards/{board_token}/jobs/{job_id}?questions=true
   * Returns full job including content (HTML description) and questions array.
   */
  async fetchJobDetail(boardToken: string, jobId: number | string): Promise<GreenhouseJobRaw> {
    const url = `${this.API_BASE}/${boardToken}/jobs/${jobId}?questions=true`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<GreenhouseJobRaw>(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'JobConcierge/1.0',
            'Accept': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (err: any) {
      this.logger.warn(`Could not fetch detail for job ${jobId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * MAP TO ENTITY
   * Transforms raw Greenhouse API response into our Job entity shape.
   */
  private mapToEntity(raw: GreenhouseJobRaw, company: string, boardToken: string): Partial<Job> {
    // Build the apply URL — Greenhouse absolute_url is the job posting page
    // The actual application form is at the same URL
    const applyUrl = raw.absolute_url;

    // Extract location — Greenhouse nests it under location.name
    const location = raw.location?.name ?? raw.offices?.[0]?.location ?? null;

    // Strip HTML tags from job description for plain text storage
    const jobDescription = raw.content
      ? this.stripHtml(raw.content)
      : null;

    return {
      title: raw.title,
      company,
      location,
      applyUrl,
      url: raw.absolute_url,
      source: `greenhouse:${boardToken}`,
      salaryRange: undefined,          // Greenhouse doesn't expose salary in their public API
      jobDescription:jobDescription || undefined,
      datePosted: raw.updated_at ? new Date(raw.updated_at) : undefined,
      atsType: AtsType.GREENHOUSE,
      externalJobId: String(raw.id),
        questions: raw.questions ?? null,
    };
  }

  /**
   * STRIP HTML
   * Removes HTML tags from Greenhouse job description content.
   * Preserves line breaks for readability.
   */
private stripHtml(html: string): string {
  if (!html) return '';

  const decoded = decode(html).replace(/\u00a0/g, ' ');

  return decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[&amp;[^\]]*\]/g, '')   // removes leftover [&amp;_...] Tailwind noise
    .replace(/&amp;/g, '')              // catches any remaining encoded ampersands
    .replace(/\[[^\]]*\]/g, '')         // removes any remaining [...] blocks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

  /**
   * SLEEP — rate limiting helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}