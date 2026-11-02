import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  IAtsAdapter,
  CandidatePayload,
  JobPayload,
  AdapterSubmitResult,
} from '../adapters/interfaces/interfaces';
import { LlmMappingService, FlatQuestion, LlmMappedAnswers } from '../llm-service/llm-mapping.service';
import { SavedAnswersService } from '../../../saved-answers/services/saved-answers.service';
import { PythonAutomationService, PythonExecutionPayload } from '../automation/python-automation-service';

export interface GreenhouseQuestion {
  required: boolean;
  label: string;
  fields: Array<{ name: string; type: string; values: any[] }>;
}

@Injectable()
export class GreenhouseAdapter implements IAtsAdapter {
  private readonly logger = new Logger(GreenhouseAdapter.name);
  private readonly API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

  private readonly SKIP_LABELS = new Set(['first name', 'last name', 'email', 'phone', 'resume/cv', 'cover letter']);
  private readonly SKIP_NAMES = new Set(['first_name', 'last_name', 'email', 'phone', 'resume', 'resume_text']);

  constructor(
    private readonly httpService: HttpService,
    private readonly llmMappingService: LlmMappingService,
    private readonly savedAnswersService: SavedAnswersService,
    private readonly pythonService: PythonAutomationService,
  ) {}

  detect(jobUrl: string): boolean {
    return jobUrl.includes('greenhouse.io');
  }

  supportsApiApply(): boolean { return true; }
  supportsBrowserApply(): boolean { return true; }
  requiredFields(): string[] { return ['firstName', 'lastName', 'email']; }

  mapCandidate(candidate: CandidatePayload, job: JobPayload): Record<string, any> {
    return { ...candidate, platform: 'greenhouse', jobUrl: job.applyUrl };
  }

  async submitApplication(
    mappedPayload: Record<string, any>,
    job: JobPayload,
    candidate: CandidatePayload,
  ): Promise<AdapterSubmitResult> {
    const boardToken = this.extractBoardToken(job.applyUrl);
    const externalJobId = job.externalJobId ?? this.extractJobId(job.applyUrl);

    if (!boardToken || !externalJobId) return this.browserFallback(mappedPayload, job, candidate, [], {});

    // 1. Fetch & Flatten
    const rawQuestions = (job.questions as GreenhouseQuestion[]) || await this.fetchJobQuestions(boardToken, externalJobId);
    const flatQuestions = this.flattenQuestions(rawQuestions);

    // 2. Cross-Job Memory: Match Global Labels to current Name IDs
    const globalMemory = await this.savedAnswersService.getAnswerMap(candidate.clientId, 'greenhouse');
    const currentJobCache: Record<string, string> = {};
    for (const q of flatQuestions) {
      const key = q.label.toLowerCase().trim();
      if (globalMemory[key]) currentJobCache[q.name] = globalMemory[key];
    }

    // 3. LLM Reasoning
    const llmAnswers = await this.llmMappingService.mapQuestions(flatQuestions, candidate, currentJobCache);

    // 4. Persistence (Label-keyed)
    await this.persistLlmAnswers(candidate.clientId, flatQuestions, llmAnswers, globalMemory);
    
    // 5. Validation
    const missing = flatQuestions.filter(q => q.required && (!llmAnswers[q.name] || llmAnswers[q.name] === 'null'));
    this.logger.log(`LLM Answers: ${JSON.stringify(llmAnswers)}`);
this.logger.log(`Missing required: ${JSON.stringify(missing.map(q => q.label))}`);
    if (missing.length > 0) {
      return { status: 'REQUIRES_REVIEW', reviewReason: 'UNKNOWN_QUESTION', step: 'LLM_MAPPING', reviewPayload: { missing } };
    }

    return this.browserFallback(mappedPayload, job, candidate, rawQuestions, llmAnswers);
  }

  private flattenQuestions(questions: GreenhouseQuestion[]): FlatQuestion[] {
    const flat: FlatQuestion[] = [];
    for (const q of questions) {
      if (this.SKIP_LABELS.has(q.label?.toLowerCase().trim())) continue;
      for (const field of q.fields ?? []) {
        if (field.type === 'input_file' || this.SKIP_NAMES.has(field.name)) continue;
        flat.push({ name: field.name, label: q.label, type: field.type, required: q.required, values: field.values ?? [] });
      }
    }
    return flat;
  }

  private async fetchJobQuestions(boardToken: string, jobId: string): Promise<GreenhouseQuestion[]> {
    const url = `${this.API_BASE}/${boardToken}/jobs/${jobId}?questions=true`;
    const response = await firstValueFrom(this.httpService.get(url, { timeout: 10000 }));
    return response.data?.questions ?? [];
  }

  private async persistLlmAnswers(clientId: string, flatQuestions: FlatQuestion[], llmAnswers: LlmMappedAnswers, globalMemory: Record<string, string>): Promise<void> {
    const toSave = flatQuestions.filter(q => {
      const ans = llmAnswers[q.name];
      const key = q.label.toLowerCase().trim();
      return ans && !['null', 'undefined', ''].includes(String(ans).toLowerCase()) && !globalMemory[key];
    });

    if (toSave.length === 0) return;

    await this.savedAnswersService.bulkUpsert(clientId, toSave.map(q => ({
      questionName: q.label.toLowerCase().trim(),
      questionLabel: q.label,
      answer: String(llmAnswers[q.name]),
      atsType: 'greenhouse',
    })));
  }

  private async browserFallback(mappedPayload: Record<string, any>, job: JobPayload, candidate: CandidatePayload, rawQuestions: GreenhouseQuestion[], llmAnswers: LlmMappedAnswers): Promise<AdapterSubmitResult> {
    const payload: PythonExecutionPayload = {
      jobUrl: job.applyUrl,
      platform: 'greenhouse',
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      linkedIn: candidate.linkedIn,
      address: candidate.address,
      resumeUrl: candidate.resumeUrl,
      headless: false,
      salaryExpectation: candidate.salaryExpectation,
      questions: rawQuestions,
      llmAnswers,
      savedAnswers: candidate.savedAnswers ?? {},
    };

    const result = await this.pythonService.execute(payload);
    if (result.requiresReview) return { status: 'REQUIRES_REVIEW', reviewReason: result.reviewReason, step: result.step, reviewPayload: result.data };
    
    return result.status === 'SUBMITTED' 
      ? { status: 'SUCCESS', confirmationNumber: result.confirmation, screenshotUrl: result.screenshotUrl }
      : { status: 'FAILED', failureReason: result.error, step: result.step };
  }

  private extractBoardToken(url: string): string | null {
    const match = url.match(/greenhouse\.io\/([^\/]+)\/jobs/);
    return match?.[1] ?? null;
  }

  private extractJobId(url: string): string | null {
    const match = url.match(/\/jobs\/(\d+)/);
    return match?.[1] ?? null;
  }

  async verifySubmission(confirmationNumber?: string): Promise<boolean> { return !!confirmationNumber; }
  async captureEvidence(): Promise<Record<string, any>> { return { method: 'greenhouse_browser' }; }
}