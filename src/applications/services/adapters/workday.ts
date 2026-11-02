import { Injectable, Logger } from '@nestjs/common';
import {
  IAtsAdapter,
  CandidatePayload,
  JobPayload,
  AdapterSubmitResult,
} from '../adapters/interfaces/interfaces';
import { PythonAutomationService } from '../../services/automation/python-automation-service';

/**
 * WORKDAY ADAPTER
 * ─────────────────────────────────────────────────────────────────
 * Workday does NOT expose a universal public "submit application" API
 * that works across all employer implementations.
 *
 * Each employer configures Workday differently — fields, screening
 * questions, and workflows vary per tenant.
 *
 * Strategy:
 *   - supportsApiApply() = false (always)
 *   - supportsBrowserApply() = true
 *   - Delegate entirely to PythonAutomationService (Playwright)
 *   - If the form has CAPTCHA or unknown questions → REQUIRES_REVIEW
 *
 * URL pattern: myworkdayjobs.com or wd3.myworkday.com/company/...
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class WorkdayAdapter implements IAtsAdapter {
  private readonly logger = new Logger(WorkdayAdapter.name);

  constructor(private readonly pythonService: PythonAutomationService) {}

  detect(jobUrl: string): boolean {
    return (
      jobUrl.includes('myworkdayjobs.com') ||
      jobUrl.includes('myworkday.com') ||
      jobUrl.includes('wd1.myworkday.com') ||
      jobUrl.includes('wd3.myworkday.com') ||
      jobUrl.includes('wd5.myworkday.com')
    );
  }

  // Workday has no public application submit API
  supportsApiApply(): boolean {
    return false;
  }

  supportsBrowserApply(): boolean {
    return true;
  }

  requiredFields(): string[] {
    return ['firstName', 'lastName', 'email', 'cvFilePath', 'workAuthorization'];
  }

  mapCandidate(
    candidate: CandidatePayload,
    job: JobPayload,
  ): Record<string, any> {
    // Map to the shape PythonAutomationService expects
    return {
      jobUrl: job.applyUrl,
      platform: 'workday',
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      cvFilePath: candidate.cvFilePath,
      address: candidate.address ?? '',
      workAuthorization: candidate.workAuthorization ?? '',
      requiresSponsorship: candidate.requiresSponsorship ?? false,
      savedAnswers: candidate.savedAnswers ?? {},
    };
  }

  // ─────────────────────────────────────────────
  // SUBMIT — delegate to Python Playwright service
  // ─────────────────────────────────────────────
  async submitApplication(
    mappedPayload: Record<string, any>,
    job: JobPayload,
    candidate: CandidatePayload,
  ): Promise<AdapterSubmitResult> {
    this.logger.log(`Workday browser automation starting for: ${job.applyUrl}`);

    try {
      const result = await this.pythonService.execute(mappedPayload);

      // Python service signals it needs human help
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
        failureReason: result.error ?? 'Workday browser automation failed',
        step: result.step ?? 'UNKNOWN',
      };
    } catch (error: any) {
      this.logger.error(`Workday automation error: ${error.message}`);
      return {
        status: 'FAILED',
        failureReason: `Workday automation error: ${error.message}`,
        step: 'BROWSER_EXECUTE',
      };
    }
  }

  async verifySubmission(confirmationNumber?: string): Promise<boolean> {
    return !!confirmationNumber;
  }

  async captureEvidence(): Promise<Record<string, any>> {
    return { method: 'workday_browser', note: 'Screenshots captured by Playwright service' };
  }
}