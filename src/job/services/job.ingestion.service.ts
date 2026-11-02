import { Injectable, Logger } from '@nestjs/common';
import { GreenhouseFetchService, GreenhouseFetchResult } from '../services/greenhouse.fetch.service';

/**
 * JOB INGESTION ORCHESTRATOR
 * ─────────────────────────────────────────────────────────────────
 * The single entry point for all job ingestion.
 *
 * Pattern:
 *   - Controller calls orchestrator
 *   - Orchestrator calls the platform-specific fetch service
 *   - Each fetch service handles its own API, rate limiting, mapping, deduplication
 *
 * Adding Lever later:
 *   1. Build LeverFetchService (same pattern as GreenhouseFetchService)
 *   2. Inject it here
 *   3. Add fetchFromLever() method
 *   4. Add route in controller
 *
 * This keeps all platform logic isolated — the orchestrator stays thin.
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class JobIngestionOrchestrator {
  private readonly logger = new Logger(JobIngestionOrchestrator.name);

  constructor(
    private readonly greenhouseFetch: GreenhouseFetchService,
    // private readonly leverFetch: LeverFetchService,  // ← add when ready
  ) {}

  /**
   * Fetch jobs from a Greenhouse company board and store them.
   *
   * @param boardToken  - The company's Greenhouse board token
   *                      Found in their job posting URL:
   *                      boards.greenhouse.io/{boardToken}/jobs
   * @param company     - Human-readable company name to store on the record
   * @param fetchDetail - Whether to fetch full description per job (default: true)
   */
  
  async fetchFromGreenhouse(
    boardToken: string,
    company: string,
    fetchDetail: boolean = true,
  ): Promise<GreenhouseFetchResult> {
    this.logger.log(`Orchestrator → Greenhouse | board: ${boardToken} | company: ${company}`);
    return this.greenhouseFetch.fetchAndStore(boardToken, company, fetchDetail);
  }

  /**
   * Fetch jobs from multiple Greenhouse boards in sequence.
   * Useful for ingesting jobs from multiple partner companies at once.
   *
   * @param boards - Array of { boardToken, company } pairs
   */
  async fetchFromGreenhouseBulk(
    boards: Array<{ boardToken: string; company: string }>,
  ): Promise<GreenhouseFetchResult[]> {
    this.logger.log(`Orchestrator → Greenhouse bulk | ${boards.length} boards`);

    const results: GreenhouseFetchResult[] = [];

    for (const board of boards) {
      try {
        const result = await this.greenhouseFetch.fetchAndStore(
          board.boardToken,
          board.company,
        );
        results.push(result);
      } catch (err: any) {
        this.logger.error(
          `Bulk fetch failed for board ${board.boardToken}: ${err.message}`,
        );
        results.push({
          company: board.company,
          boardToken: board.boardToken,
          total: 0,
          created: 0,
          skipped: 0,
          failed: -1,
        });
      }
    }

    return results;
  }

  // ── Lever (placeholder — add when LeverFetchService is built) ──
  // async fetchFromLever(site: string, company: string): Promise<LeverFetchResult> {
  //   return this.leverFetch.fetchAndStore(site, company);
  // }
}