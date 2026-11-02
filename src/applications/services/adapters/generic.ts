import { Injectable, Logger } from '@nestjs/common';
import {
  IAtsAdapter,
  CandidatePayload,
  JobPayload,
  AdapterSubmitResult,
} from '../adapters/interfaces/interfaces';
import { PythonAutomationService } from '../automation/python-automation-service';

/**
 * GENERIC CAREER SITE ADAPTER
 * ─────────────────────────────────────────────────────────────────
 * Catch-all adapter for any ATS platform not explicitly supported.
 *
 * This adapter:
 *   - Always uses browser automation (no API available)
 *   - Delegates to Python/Playwright
 *   - Is the final fallback in the AtsAdapterFactory
 *
 * Supported implicitly: iCIMS, SmartRecruiters, BambooHR, Ashby,
 *   custom career pages, and anything else Playwright can handle.
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class GenericCareerSiteAdapter implements IAtsAdapter {
  private readonly logger = new Logger(GenericCareerSiteAdapter.name);

  constructor(private readonly pythonService: PythonAutomationService) {}

  // Generic always matches — it's the last resort
  detect(_jobUrl: string): boolean {
    return true;
  }

  supportsApiApply(): boolean {
    return false;
  }

  supportsBrowserApply(): boolean {
    return true;
  }

  requiredFields(): string[] {
    return ['firstName', 'lastName', 'email', 'cvFilePath'];
  }

  mapCandidate(
    candidate: CandidatePayload,
    job: JobPayload,
  ): Record<string, any> {
    return {
      jobUrl: job.applyUrl,
      platform: 'generic',
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      cvFilePath: candidate.cvFilePath,
      address: candidate.address ?? '',
      linkedIn: candidate.linkedIn ?? '',
      savedAnswers: candidate.savedAnswers ?? {},
    };
  }

  async submitApplication(
    mappedPayload: Record<string, any>,
    job: JobPayload,
    candidate: CandidatePayload,
  ): Promise<AdapterSubmitResult> {
    this.logger.log(
      `Generic browser automation for: ${job.applyUrl} [${job.company}]`,
    );

    try {
      const result = await this.pythonService.execute(mappedPayload);

      if (result.requiresReview) {
        return {
          status: 'REQUIRES_REVIEW',
          reviewReason: result.reviewReason ?? 'UNKNOWN_QUESTION',
          reviewPayload: result.data ?? {},
          step: result.step ?? 'UNKNOWN',
        };
      }

      if (result.status === 'SUBMITTED') {
        return {
          status: 'SUCCESS',
          confirmationNumber: result.confirmation ?? "Not provided",
          screenshotUrl: result.screenshotUrl ?? "Not provided",
        };
      }

      return {
        status: 'FAILED',
        failureReason: result.error ?? 'Generic browser automation failed',
        step: result.step ?? 'UNKNOWN',
      };
    } catch (error: any) {
      this.logger.error(`Generic adapter error: ${error.message}`);
      return {
        status: 'FAILED',
        failureReason: `Generic automation error: ${error.message}`,
        step: 'BROWSER_EXECUTE',
      };
    }
  }

  async verifySubmission(confirmationNumber?: string): Promise<boolean> {
    return !!confirmationNumber;
  }

  async captureEvidence(): Promise<Record<string, any>> {
    return { method: 'generic_browser', note: 'Screenshots captured by Playwright' };
  }
}