import { Injectable, Logger } from '@nestjs/common';
import { IAtsAdapter } from '../../adapters/interfaces/interfaces';
import { GreenhouseAdapter } from '../greenhouse';
import { LeverAdapter } from '../lever';
//import { WorkdayAdapter } from '../';
import { GenericCareerSiteAdapter } from '../generic';
import { WorkdayAdapter } from '../workday';

/**
 * ATS ADAPTER FACTORY
 * ─────────────────────────────────────────────────────────────────
 * Single responsibility: given a job URL or atsType string,
 * return the correct adapter instance.
 *
 * Resolution order:
 *   1. Check atsType string first (set during job ingestion)
 *   2. If atsType is 'unknown' or missing → run detect() on each adapter
 *   3. GenericCareerSiteAdapter is always the final fallback
 *
 * How to add a new adapter:
 *   1. Create adapters/icims.adapter.ts implementing IAtsAdapter
 *   2. Add it to the ATS_TYPE_MAP below
 *   3. Add it to the DETECT_ORDER array
 *   4. Register it as a provider in ats.module.ts
 *
 * That's it. The orchestrator never changes.
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class AtsAdapterFactory {
  private readonly logger = new Logger(AtsAdapterFactory.name);

  constructor(
    private readonly greenhouse: GreenhouseAdapter,
    private readonly lever: LeverAdapter,
    private readonly workday: WorkdayAdapter,
    private readonly generic: GenericCareerSiteAdapter,
  ) {}

  // ─────────────────────────────────────────────
  // atsType → adapter map
  // Populated during job ingestion when we know the ATS
  // ─────────────────────────────────────────────
  private readonly ATS_TYPE_MAP: Record<string, IAtsAdapter> = {
    greenhouse: null!,  // assigned in constructor — see below
    lever: null!,
    workday: null!,
    smartrecruiters: null!,
    icims: null!,
    ashby: null!,
    bamboohr: null!,
    generic: null!,
  };

  // ─────────────────────────────────────────────
  // Detection order when atsType is unknown
  // More specific adapters must come BEFORE generic
  // ─────────────────────────────────────────────
  private get DETECT_ORDER(): IAtsAdapter[] {
    return [
      this.greenhouse,
      this.lever,
      this.workday,
      this.generic, // always last
    ];
  }

  // Called after NestJS DI completes — wire up the map
  onModuleInit() {
    this.ATS_TYPE_MAP['greenhouse'] = this.greenhouse;
    this.ATS_TYPE_MAP['lever'] = this.lever;
    this.ATS_TYPE_MAP['workday'] = this.workday;
    this.ATS_TYPE_MAP['smartrecruiters'] = this.generic; // browser fallback until dedicated adapter built
    this.ATS_TYPE_MAP['icims'] = this.generic;
    this.ATS_TYPE_MAP['ashby'] = this.generic;
    this.ATS_TYPE_MAP['bamboohr'] = this.generic;
    this.ATS_TYPE_MAP['generic'] = this.generic;
  }

  /**
   * PRIMARY METHOD — call this from the orchestrator.
   *
   * @param atsType  - The ATS type stored on the Job entity (e.g. 'greenhouse')
   * @param jobUrl   - The actual job apply URL — used for URL-based detection
   * @returns        The correct IAtsAdapter
   */
  resolve(atsType: string, jobUrl: string): IAtsAdapter {
    // ── Step 1: Try atsType map first (fastest, most reliable) ──
    if (atsType && atsType !== 'unknown') {
      const normalized = atsType.toLowerCase().trim();
      const mapped = this.ATS_TYPE_MAP[normalized];

      if (mapped) {
        this.logger.log(`Adapter resolved by atsType: ${normalized}`);
        return mapped;
      }
    }

    // ── Step 2: URL-based detection ──
    for (const adapter of this.DETECT_ORDER) {
      if (adapter.detect(jobUrl)) {
        this.logger.log(
          `Adapter resolved by URL detection: ${adapter.constructor.name}`,
        );
        return adapter;
      }
    }

    // ── Step 3: Generic fallback (should always be reached last) ──
    this.logger.warn(
      `No specific adapter found for atsType="${atsType}" url="${jobUrl}" — using GenericCareerSiteAdapter`,
    );
    return this.generic;
  }
}