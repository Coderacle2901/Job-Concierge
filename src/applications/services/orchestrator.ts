import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApplicationRecord } from '../entities/application.entity';
import { ApplicationAttempt, AttemptResult } from '../entities/application-attempts';
import { ApplicationStatus } from '../enums/application-status.enum';
import { ReviewTask, ReviewTaskType, ReviewTaskStatus } from '../../review/entities/review-task.entity';
import { Client } from '../../clients/entities/client.entity';
import { ResumeVariant } from '../../resumes/entities/resume.entity';
import { Job } from '../../job/entities/job.entity';

import { AtsAdapterFactory } from '../services/adapters/factory/ats-adapter-factory';
import {
  CandidatePayload,
  JobPayload,
  AdapterSubmitResult,
} from '../services/adapters/interfaces/interfaces';

export interface OrchestratorInput {
  applicationId: string;
  attemptId: string;
  clientId: string;
  jobId: string;
  resumeId: string;
}

export interface OrchestratorResult {
  status: 'SUCCESS' | 'FAILED' | 'REQUIRES_REVIEW';
  message: string;
  confirmationNumber?: string | null;
  screenshotUrl?: string | null;
  reviewTaskId?: string;
}

/**
 * APPLICATION ORCHESTRATOR SERVICE
 * ─────────────────────────────────────────────────────────────────
 * Owns all application execution business logic.
 *
 * Responsibilities:
 * 1. Load all entities needed for an application run
 * 2. Validate candidate completeness against adapter requirements
 * 3. Resolve the correct ATS adapter via AtsAdapterFactory
 * 4. Log which route will be used: API / BROWSER / ASSISTED
 * 5. Execute the application via the adapter
 * 6. Handle all outcomes: SUCCESS / FAILED / REQUIRES_REVIEW
 * 7. Update ApplicationRecord + ApplicationAttempt in DB
 * 8. Create ReviewTask when human intervention is needed
 *
 * NOT responsible for:
 * - Queue mechanics (ApplyQueueWorker handles that)
 * - BullMQ retry logic (worker handles that)
 * - HTTP transport (adapters + PythonAutomationService handle that)
 *
 * Called by:
 * - ApplyQueueWorker        → primary async path
 * - Admin retry endpoint    → manual re-run from dashboard
 * - Future retry scheduler  → time-delayed retries
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class ApplicationOrchestratorService {
  private readonly logger = new Logger(ApplicationOrchestratorService.name);

  constructor(
    @InjectRepository(ApplicationRecord)
    private readonly applicationRepo: Repository<ApplicationRecord>,

    @InjectRepository(ApplicationAttempt)
    private readonly attemptRepo: Repository<ApplicationAttempt>,

    @InjectRepository(ReviewTask)
    private readonly reviewRepo: Repository<ReviewTask>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(ResumeVariant)
    private readonly resumeRepo: Repository<ResumeVariant>,

    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,

    private readonly adapterFactory: AtsAdapterFactory,
  ) {}

  // ─────────────────────────────────────────────
  // MAIN ENTRY POINT
  // Called by the worker (and admin retry).
  // Returns a clean OrchestratorResult — no raw DB entities leaked out.
  // ─────────────────────────────────────────────
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const { applicationId, attemptId, clientId, jobId, resumeId } = input;

    this.logger.log(`Orchestrator starting — application: ${applicationId}`);

    // ── Step 1: Mark IN_PROGRESS ──
    await this.setApplicationStatus(applicationId, ApplicationStatus.IN_PROGRESS);

    // ── Step 2: Load all required entities in parallel ──
    const [client, resume, job] = await Promise.all([
      this.loadClient(clientId),
      this.loadResume(resumeId),
      this.loadJob(jobId),
    ]);

    // ── Step 3: Build canonical payloads ──
    const candidatePayload = this.buildCandidatePayload(client, resume);
    const jobPayload = this.buildJobPayload(job);

    // ── Step 4: Resolve ATS adapter ──
    const adapter = this.adapterFactory.resolve(
      job.atsType ?? 'unknown',
      jobPayload.applyUrl,
    );

    this.logger.log(
      `Adapter: ${adapter.constructor.name} | API=${adapter.supportsApiApply()} | Browser=${adapter.supportsBrowserApply()}`,
    );

    // ── Step 5: Validate candidate has all fields this adapter needs ──
    const missingFields = this.validateFields(
      candidatePayload,
      adapter.requiredFields(),
    );

    if (missingFields.length > 0) {
      this.logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      return this.handleReviewRequired(applicationId, attemptId, {
        status: 'REQUIRES_REVIEW',
        reviewReason: 'APPROVAL_NEEDED',
        reviewPayload: {
          reason: 'Candidate profile is missing required fields',
          missingFields,
        },
        step: 'FIELD_VALIDATION',
      });
    }

    // ── Step 6: Map candidate → ATS-specific shape ──
    const mappedPayload = adapter.mapCandidate(candidatePayload, jobPayload);

    // ── Step 7: Determine and log the execution route ──
    const route = this.resolveRoute(adapter);
    this.logger.log(`Execution route: ${route}`);
    await this.updateAttemptStep(attemptId, `EXECUTING_${route}`);

    // ── Step 8: Execute via the adapter ──
    const result = await adapter.submitApplication(
      mappedPayload,
      jobPayload,
      candidatePayload,
    );

    // ── Step 9: Handle outcome ──
    return this.handleResult(applicationId, attemptId, result);
  }

  // ─────────────────────────────────────────────
  // ROUTE RESOLVER
  // Purely informational — tells us which path will run.
  // The adapter decides internally how to execute.
  // ─────────────────────────────────────────────
  private resolveRoute(adapter: any): 'API' | 'BROWSER' | 'ASSISTED' {
    if (adapter.supportsApiApply()) return 'API';
    if (adapter.supportsBrowserApply()) return 'BROWSER';
    return 'ASSISTED';
  }

  // ─────────────────────────────────────────────
  // RESULT DISPATCHER
  // ─────────────────────────────────────────────
  private async handleResult(
    applicationId: string,
    attemptId: string,
    result: AdapterSubmitResult,
  ): Promise<OrchestratorResult> {
    switch (result.status) {
      case 'SUCCESS':
        return this.handleSuccess(applicationId, attemptId, result);
      case 'REQUIRES_REVIEW':
        return this.handleReviewRequired(applicationId, attemptId, result);
      case 'FAILED':
      default:
        return this.handleFailure(applicationId, attemptId, result);
    }
  }

  // ─────────────────────────────────────────────
  // SUCCESS
  // ─────────────────────────────────────────────
  private async handleSuccess(
    applicationId: string,
    attemptId: string,
    result: AdapterSubmitResult,
  ): Promise<OrchestratorResult> {
    await this.attemptRepo.update(attemptId, {
      result: AttemptResult.SUCCESS,
      confirmationNumber: result.confirmationNumber ?? null,
      screenshotUrl: result.screenshotUrl ?? null,
      step: 'COMPLETED',
      nextStep: null,
    });

    await this.setApplicationStatus(applicationId, ApplicationStatus.APPLIED);

    this.logger.log(
      `✅ Application ${applicationId} SUBMITTED | Confirmation: ${result.confirmationNumber ?? 'N/A'}`,
    );

    return {
      status: 'SUCCESS',
      message: 'Application submitted successfully',
      confirmationNumber: result.confirmationNumber,
      screenshotUrl: result.screenshotUrl,
    };
  }

  // ─────────────────────────────────────────────
  // REQUIRES REVIEW
  // Pauses the application, creates ReviewTask
  // for concierge staff or user to resolve
  // ─────────────────────────────────────────────
  private async handleReviewRequired(
    applicationId: string,
    attemptId: string,
    result: Partial<AdapterSubmitResult> & { reviewPayload?: any; step?: string },
  ): Promise<OrchestratorResult> {
    await this.attemptRepo.update(attemptId, {
      result: AttemptResult.WAITING_REVIEW,
      step: result.step ?? 'UNKNOWN',
      nextStep: 'REVIEW',
      metadata: result.reviewPayload ?? {},
    });

    await this.setApplicationStatus(applicationId, ApplicationStatus.WAITING_REVIEW);

    const reviewTask = this.reviewRepo.create({
      applicationId,
      attemptId,
      taskType: this.mapReviewReason(result.reviewReason),
      payload: result.reviewPayload ?? {},
      status: ReviewTaskStatus.PENDING,
      requiresUserInput: true,
    });

    const savedTask = await this.reviewRepo.save(reviewTask);

    this.logger.warn(
      `⏸ Application ${applicationId} PAUSED | Reason: ${result.reviewReason} | ReviewTask: ${savedTask.id}`,
    );

    return {
      status: 'REQUIRES_REVIEW',
      message: `Application paused: ${result.reviewReason ?? 'review required'}`,
      reviewTaskId: savedTask.id,
    };
  }

  // ─────────────────────────────────────────────
  // FAILURE
  // ─────────────────────────────────────────────
  private async handleFailure(
    applicationId: string,
    attemptId: string,
    result: AdapterSubmitResult,
  ): Promise<OrchestratorResult> {
    await this.attemptRepo.update(attemptId, {
      result: AttemptResult.FAILED,
      failureReason: result.failureReason ?? 'Unknown failure',
      step: result.step ?? 'FAILED',
    });

    await this.setApplicationStatus(applicationId, ApplicationStatus.FAILED);

    //   THE FIX: Intercept the crash and create a ReviewTask so it hits the Staff Dashboard!
    const reviewTask = this.reviewRepo.create({
      applicationId,
      attemptId,
      taskType: ReviewTaskType.APPROVAL_NEEDED, 
      payload: {
        reason: result.failureReason ?? 'Unknown failure',
        step: result.step ?? 'UNKNOWN_STEP',
        systemMessage: 'The automation worker crashed or the job was no longer available.'
      },
      status: ReviewTaskStatus.PENDING,
      requiresUserInput: false, // Staff will handle it manually
    });

    const savedTask = await this.reviewRepo.save(reviewTask);

    this.logger.error(
      `❌ Application ${applicationId} FAILED | ${result.failureReason} | Step: ${result.step} | ReviewTask Created: ${savedTask.id}`,
    );

    return {
      status: 'FAILED',
      message: result.failureReason ?? 'Application failed',
      reviewTaskId: savedTask.id,
    };
  }

  // ─────────────────────────────────────────────
  // ENTITY LOADERS
  // ─────────────────────────────────────────────
private async loadClient(id: string): Promise<Client> {
  const client = await this.clientRepo.findOne({ 
    where: { id },
    relations: ['profile'],  // ← add this
  });
  if (!client) throw new NotFoundException(`Client not found: ${id}`);
  return client;
}

  private async loadResume(id: string): Promise<ResumeVariant> {
    const resume = await this.resumeRepo.findOne({ where: { id } });
    if (!resume) throw new NotFoundException(`Resume not found: ${id}`);
    return resume;
  }

  private async loadJob(id: string): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job not found: ${id}`);
    return job;
  }

  // ─────────────────────────────────────────────
  // PAYLOAD BUILDERS
  // ─────────────────────────────────────────────
private buildCandidatePayload(client: Client, resume: ResumeVariant): CandidatePayload {
  const profile = client.profile;
 
  // ----------------------------------------------------------
  // Derive noticePeriod from noticePeriod column first,
  // then fall back to startDate (e.g. "immediately" → "Available immediately")
  // ----------------------------------------------------------
  const noticePeriod = profile.noticePeriod ?? null;
 
  return {
    clientId: client.id,
    firstName: client.firstName ?? client.name?.split(' ')[0] ?? 'FirstName',
    lastName: client.lastName ?? client.name?.split(' ').slice(1).join(' ') ?? 'LastName',
    email: client.email,
    phone: profile?.phone ?? undefined,
    linkedIn: profile?.linkedin ?? undefined,         // lowercase 'linkedin' on entity
    portfolio: profile?.portfolio ?? undefined,
    address: profile?.location ?? undefined,
 
    // Compliance
    workAuthorization: profile?.workAuthorization ?? undefined,
    requiresSponsorship: profile?.requiresSponsorship ?? false,
 
    // Salary
    salaryExpectation: profile?.minSalary ? profile.minSalary : undefined,
 
    cvFilePath: resume.fileUrl,
    resumeUrl: resume.fileUrl,
    savedAnswers: resume.content?.savedAnswers ?? {},
 
    // Resume structured content — resume first, profile JSONB as fallback
    resumeContent: {
      skills: resume.content?.skills?.length
        ? resume.content.skills
        : (profile?.skills ?? []),
      summary: resume.content?.summary ?? profile?.currentRole ?? null,
      experience: resume.content?.experience?.length
        ? resume.content.experience
        : (profile?.experience ?? []),
      education: resume.content?.education?.length
        ? resume.content.education
        : (profile?.education ?? []),
      certifications: resume.content?.certifications?.length
        ? resume.content.certifications
        : (profile?.certifications ?? []),
      totalYearsExperience: profile?.experienceYears
        ? parseInt(profile.experienceYears)
        : 0,
    },
 
    // Preferences — noticePeriod now resolved from startDate fallback
    preferences: {
      remoteOnly: profile?.remoteOnly ?? false,
      willingToRelocate: profile?.willingToRelocate ?? false,
      openToOnsiteRoles: profile?.openToOnsiteRoles ?? true,
      noticePeriod,                                             // ← resolved above
      currentSalary: profile?.currentSalary ? Number(profile.currentSalary) : null,
      preferredTools: profile?.preferredTools ?? [],
      preferredLocations: profile?.preferredLocations ?? [],
    },
  };
}
 
// ----------------------------------------------------------
// Resolves a human-readable notice period string from the
// noticePeriod column OR the startDate column as fallback.
//
// startDate examples in DB:  "immediately", "2 weeks", "1 month", "flexible"
// ----------------------------------------------------------
private resolveNoticePeriod(
  noticePeriod: string | null,
  startDate: string | null,
): string | null {
  if (noticePeriod && noticePeriod.trim().length > 0) return noticePeriod.trim();
 
  if (!startDate) return null;
 
  const val = startDate.toLowerCase().trim();
 
  if (val === 'immediately' || val === 'asap') return 'Available immediately';
  if (val === 'flexible')                       return 'Flexible';
  if (val.includes('week'))                     return startDate.trim();   // "2 weeks" → "2 weeks"
  if (val.includes('month'))                    return startDate.trim();   // "1 month" → "1 month"
 
  // Anything else: return as-is (e.g. a date string "2026-06-01")
  return startDate.trim();
}

  private buildJobPayload(job: Job): JobPayload {
    return {
      id: job.id,
      url: job.applyUrl,
      applyUrl: job.applyUrl,
      title: job.title,
      company: job.company,
      atsType: job.atsType ?? 'unknown',
     questions: job.questions ?? null,
      externalJobId: job.externalJobId ?? undefined,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  private validateFields(candidate: CandidatePayload, required: string[]): string[] {
    return required.filter(field => {
      const value = (candidate as any)[field];
      return value === undefined || value === null || value === '';
    });
  }

  private async setApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
    await this.applicationRepo.update(id, { status });
  }

  private async updateAttemptStep(attemptId: string, step: string): Promise<void> {
    await this.attemptRepo.update(attemptId, { step });
  }

  private mapReviewReason(reason?: string): ReviewTaskType {
    const map: Record<string, ReviewTaskType> = {
      CAPTCHA: ReviewTaskType.CAPTCHA,
      UNKNOWN_QUESTION: ReviewTaskType.UNKNOWN_QUESTION,
      ESSAY_REQUIRED: ReviewTaskType.ESSAY_REQUIRED,
      APPROVAL_NEEDED: ReviewTaskType.APPROVAL_NEEDED,
    };
    return map[reason ?? ''] ?? ReviewTaskType.UNKNOWN_QUESTION;
  }
}