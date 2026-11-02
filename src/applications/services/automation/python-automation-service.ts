import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * PYTHON AUTOMATION SERVICE
 * ─────────────────────────────────────────────────────────────────
 * NestJS HTTP client that talks to the Python FastAPI automation
 * service running at PYTHON_SERVICE_URL (env variable).
 *
 * The Python service handles all Playwright browser automation.
 * This service is the ONLY point in NestJS that knows the Python
 * service exists — everything else talks to this service.
 *
 * Endpoints bridged:
 *   POST /submit-application  → run_automation() in Python
 *   GET  /health              → health check
 *
 * Contract: Python response is normalized into PythonExecutionResult
 * so the adapters and orchestrator never parse raw Python responses.
 * ─────────────────────────────────────────────────────────────────
 */

export interface PythonExecutionPayload {
  // ── Routing ──────────────────────────────────────────────────────
  jobUrl: string;
  platform: string;           // 'greenhouse' | 'lever' | 'generic'

  // ── Candidate identity ────────────────────────────────────────────
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  portfolio?: string;
  address?: string;

  // ── Resume ────────────────────────────────────────────────────────
  // resumeUrl → Supabase Storage URL, Python downloads at runtime via httpx
  // cvFilePath → local path, only used in dev/testing
  resumeUrl?: string;
  cvFilePath?: string;

  // ── Automation settings ───────────────────────────────────────────
  headless?: boolean;

  // ── Candidate preferences ─────────────────────────────────────────
  workAuthorization?: string;
  requiresSponsorship?: boolean;
  salaryExpectation?: number | string;

  // ── LLM-mapped answers (Greenhouse) ──────────────────────────────
  // Built by GreenhouseAdapter after Gemini call.
  // Key: question field name e.g. "question_8200214006"
  // Value: answer string or null
  llmAnswers?: Record<string, string | null>;

  // ── Questions array (Greenhouse) ─────────────────────────────────
  // Raw Greenhouse questions array — tells Python each field's
  // type and dropdown options so it knows HOW to fill each field.
  questions?: Array<Record<string, any>>;

  // ── Saved answers (Lever / Generic fallback) ──────────────────────
  // Pre-cached answers keyed by field name or question text.
  savedAnswers?: Record<string, string>;
}

export interface PythonExecutionResult {
  status: 'SUBMITTED' | 'FAILED' | 'REQUIRES_REVIEW';
  confirmation?: string;
  error?: string;
  screenshotUrl?: string;

  // Extended fields the Python service can return for review scenarios
  requiresReview?: boolean;
  reviewReason?: 'CAPTCHA' | 'UNKNOWN_QUESTION' | 'ESSAY_REQUIRED' | 'APPROVAL_NEEDED';
  step?: string;
  data?: Record<string, any>;
}

@Injectable()
export class PythonAutomationService {
  private readonly logger = new Logger(PythonAutomationService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Reads PYTHON_SERVICE_URL from .env — e.g. http://localhost:8000
    this.baseUrl = this.configService.get<string>(
      'PYTHON_SERVICE_URL',
      'http://127.0.0.1:8000',
    );
  }

  // ─────────────────────────────────────────────
  // EXECUTE
  // Main method called by adapters.
  // Sends the mapped payload to Python and returns a normalized result.
  // ─────────────────────────────────────────────
  async execute(payload: PythonExecutionPayload| Record<string, any> ): Promise<PythonExecutionResult> {
    const endpoint = `${this.baseUrl}/submit-application`;

    this.logger.log(
      `Calling Python automation service: ${payload.platform} | ${payload.email} | ${payload.jobUrl}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          timeout: 500_000, // 2 minutes — Playwright can be slow on complex forms
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const data = response.data;
      this.logger.log(`Python service responded: status=${data.status}`);

      // ── Normalize Python response into PythonExecutionResult ──
      return this.normalizeResponse(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─────────────────────────────────────────────
  // HEALTH CHECK
  // Called on startup or by a scheduled job to verify Python is reachable
  // ─────────────────────────────────────────────
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`, { timeout: 5000 }),
      );
      this.logger.log('Python automation service is healthy');
      return response.status === 200;
    } catch {
      this.logger.warn('Python automation service is unreachable');
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE: Normalize the raw Python response
  //
  // Python currently returns: { status, confirmation, error }
  // We extend it to support: { requiresReview, reviewReason, step, data }
  // This keeps adapters clean — they only see PythonExecutionResult
  // ─────────────────────────────────────────────
  private normalizeResponse(data: any): PythonExecutionResult {
    // Python service returned REQUIRES_REVIEW status
    if (data.status === 'REQUIRES_REVIEW') {
      return {
        status: 'REQUIRES_REVIEW',
        requiresReview: true,
        reviewReason: data.reviewReason ?? 'UNKNOWN_QUESTION',
        step: data.step ?? 'UNKNOWN',
        data: data.data ?? {},
        screenshotUrl: data.screenshotUrl ?? null,
      };
    }

    // Python service returned SUBMITTED (success)
    if (data.status === 'SUBMITTED') {
      return {
        status: 'SUBMITTED',
        requiresReview: false,
        confirmation: data.confirmation ?? null,
        screenshotUrl: data.screenshotUrl ?? null,
      };
    }

    // FAILED or anything else
    return {
      status: 'FAILED',
      requiresReview: false,
      error: data.error ?? 'Python service returned unexpected status',
      step: data.step ?? null,
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE: Handle HTTP + network errors
  //
  // Distinguishes between:
  //   - Python service returned an HTTP error (4xx/5xx)
  //   - Python service is completely unreachable (ECONNREFUSED, timeout)
  // ─────────────────────────────────────────────
  private handleError(error: any): PythonExecutionResult {
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      // Python service responded with an error status code
      const status = axiosError.response.status;
      const data = axiosError.response.data as any;
      this.logger.error(
        `Python service HTTP error: ${status} | ${data?.detail ?? 'No detail'}`,
      );
      return {
        status: 'FAILED',
        error: `Python service error (${status}): ${data?.detail ?? 'Unknown error'}`,
      };
    }

    if (axiosError.code === 'ECONNREFUSED') {
      this.logger.error('Python automation service is not running (ECONNREFUSED)');
      return {
        status: 'FAILED',
        error: 'Automation service unavailable — please try again later',
      };
    }

    if (axiosError.code === 'ETIMEDOUT' || axiosError.message?.includes('timeout')) {
      this.logger.error('Python automation service timed out');
      return {
        status: 'FAILED',
        error: 'Automation timed out — the application form may require manual review',
      };
    }

    this.logger.error(`Unexpected error calling Python service: ${error.message}`);
    return {
      status: 'FAILED',
      error: `Unexpected automation error: ${error.message}`,
    };
  }
}