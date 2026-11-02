import {
  Injectable, NotFoundException, Logger, BadRequestException, InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm'; //   IMPORTED 'In'
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ApplicationRecord } from '../entities/application.entity';
import { ApplicationAttempt, AttemptMethod, AttemptResult } from '../entities/application-attempts';
import { ApplicationStatus } from '../enums/application-status.enum';
import { JobsService } from '../../job/services/job.service';
import { SubmitApplicationDto } from '../dto/submit-application-dto';
import {
  APPLY_QUEUE,
  ApplyJobData,
  DEFAULT_JOB_OPTIONS,
} from '../queue/queue.constants';
import { QuotaService } from '../../quota/quota.service'; 

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(ApplicationRecord)
    private readonly applicationRepo: Repository<ApplicationRecord>,

    @InjectRepository(ApplicationAttempt)
    private readonly attemptRepo: Repository<ApplicationAttempt>,


    private readonly jobsService: JobsService,

    @InjectQueue(APPLY_QUEUE)
    private readonly applyQueue: Queue<ApplyJobData>,

    private readonly quotaService: QuotaService, 
  ) {}

  // ─────────────────────────────────────────────
  //   NEW: CONCIERGE TARGET REQUEST (TYPE 2)
  // ─────────────────────────────────────────────
  async createApplicationRequest(dto: { clientId: string; company: string; role: string; location?: string; jobUrl: string; jobDescription?: string }) {
    this.logger.log(`Concierge Request logged — client: ${dto.clientId} → ${dto.company}`);

    await this.quotaService.deductQuota(dto.clientId, 'SUBMIT_APPLICATION');

    try {
      const job = await this.jobsService.createCustomJob({
        title: dto.role,
        company: dto.company,
        location: dto.location,
        applyUrl: dto.jobUrl,
        description: dto.jobDescription,
        atsType: 'UNKNOWN' 
      });

      const application = this.applicationRepo.create({
        status: ApplicationStatus.PENDING_RESUME, 
        client: { id: dto.clientId },
        job: { id: job.id },
      });

      const savedApplication = await this.applicationRepo.save(application);
      this.logger.log(`Application Target Locked: ${savedApplication.id}`);

      return {
        message: 'Target Locked. Our team is generating your tailored resume.',
        application: this.formatApplication(savedApplication),
      };
    } catch (error) {
       this.logger.error(`Failed to lock target. Refunding point to Client ${dto.clientId}`, error);
       await this.quotaService.refundQuota(dto.clientId, 'SUBMIT_APPLICATION');
       throw new InternalServerErrorException('Failed to process application request.');
    }
  }

  // ─────────────────────────────────────────────
  // 1. CREATE APPLICATION (LEGACY / AUTOMATED)
  // ─────────────────────────────────────────────
  async createApplication(dto: SubmitApplicationDto): Promise<any> {
    this.logger.log(`Creating application — client: ${dto.clientId} → job: ${dto.jobId}`);

    await this.quotaService.deductQuota(dto.clientId, 'SUBMIT_APPLICATION');

    try {
      const job = await this.jobsService.getJobById(dto.jobId);

      const application = this.applicationRepo.create({
        status: ApplicationStatus.PENDING,
        client: { id: dto.clientId },
        resume: { id: dto.resumeId },
        job: { id: dto.jobId },
      });

      const savedApplication = await this.applicationRepo.save(application);
      this.logger.log(`ApplicationRecord created: ${savedApplication.id}`);

      const attempt = this.attemptRepo.create({
        method: this.resolveMethod(job.atsType),
        result: AttemptResult.PENDING,
        step: 'QUEUED',
        application: { id: savedApplication.id },
      });

      const savedAttempt = await this.attemptRepo.save(attempt);

      const queueJob = await this.applyQueue.add(
        'process-application',
        {
          applicationId: savedApplication.id,
          attemptId: savedAttempt.id,
          clientId: dto.clientId,
          jobId: dto.jobId,
          resumeId: dto.resumeId,
          retryCount: 0,
        },
        DEFAULT_JOB_OPTIONS,
      );

      this.logger.log(`Application ${savedApplication.id} enqueued → queue job: ${queueJob.id}`);

      return {
        message: 'Application queued successfully',
        applicationId: savedApplication.id,
        attemptId: savedAttempt.id,
        queueJobId: queueJob.id,
        status: ApplicationStatus.PENDING,
        job: {
          title: job.title,
          company: job.company,
          atsType: job.atsType,
        },
      };
    } catch (error) {
       this.logger.error(`Failed to queue application. Refunding 1 point to Client ${dto.clientId}`, error);
       await this.quotaService.refundQuota(dto.clientId, 'SUBMIT_APPLICATION');
       throw new InternalServerErrorException('Failed to process application request.');
    }
  }

  // ─────────────────────────────────────────────
  // 2. GET ALL APPLICATIONS FOR A CLIENT
  // ─────────────────────────────────────────────
  async getAllApplications(clientId: string, search?: string) {
    const [applications, total] = await this.applicationRepo.findAndCount({
      where: { client: { id: clientId } },
      relations: ['resume', 'job'],
      order: { applicationDate: 'DESC' },
    });

    const filtered = search
      ? applications.filter(app =>
          app.job?.title?.toLowerCase().includes(search.toLowerCase()) ||
          app.job?.company?.toLowerCase().includes(search.toLowerCase()),
        )
      : applications;

    return {
      summary: this.buildSummary(total, filtered),
      data: filtered.map(app => this.formatApplication(app)),
    };
  }

  // ─────────────────────────────────────────────
  // 3. GET APPLICATIONS BY STATUS
  // ─────────────────────────────────────────────
  async getApplicationsByStatus(clientId: string, status: ApplicationStatus) {
    const validStatuses = Object.values(ApplicationStatus);
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status "${status}". Valid values: ${validStatuses.join(', ')}`,
      );
    }

    const [applications, total] = await this.applicationRepo.findAndCount({
      where: {
        client: { id: clientId },
        status,
      },
      relations: ['resume', 'job'],
      order: { applicationDate: 'DESC' },
    });

    return {
      status,
      total,
      data: applications.map(app => this.formatApplication(app)),
    };
  }

  // ─────────────────────────────────────────────
  // 4. GET SINGLE APPLICATION BY ID
  // ─────────────────────────────────────────────
  async getApplicationById(id: string): Promise<any> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['client', 'resume', 'job', 'attempts'],
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    return {
      ...this.formatApplication(application),
      attempts: (application.attempts ?? []).map(attempt => ({
        id: attempt.id,
        method: attempt.method,
        result: attempt.result,
        step: attempt.step,
        nextStep: attempt.nextStep,
        confirmationNumber: attempt.confirmationNumber,
        screenshotUrl: attempt.screenshotUrl,
        failureReason: attempt.failureReason,
        attemptedAt: attempt.attemptedAt,
      })),
    };
  }

  // ─────────────────────────────────────────────
  // 5. DELETE APPLICATION BY ID
  // ─────────────────────────────────────────────
  async deleteApplication(id: string, clientId: string): Promise<{ message: string }> {
    const application = await this.applicationRepo.findOne({
      where: { id, client: { id: clientId } },
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    if (application.status === ApplicationStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot delete an application that is currently being processed',
      );
    }

    await this.applicationRepo.delete(id);
    this.logger.log(`Application ${id} deleted by client ${clientId}`);
    return { message: `Application ${id} deleted successfully` };
  }
  
  // ─────────────────────────────────────────────
  // 6. UPDATE APPLICATION STATUS
  // ─────────────────────────────────────────────
  async updateApplicationStatus(
    applicationId: string,
    attemptId: string,
    success: boolean,
    confirmationNumber?: string,
    screenshotUrl?: string,
    failureReason?: string,
  ): Promise<void> {
    await this.attemptRepo.update(attemptId, {
      result: success ? AttemptResult.SUCCESS : AttemptResult.FAILED,
      confirmationNumber: confirmationNumber ?? null,
      screenshotUrl: screenshotUrl ?? null,
      failureReason: failureReason ?? null,
    });

    await this.applicationRepo.update(applicationId, {
      status: success ? ApplicationStatus.APPLIED : ApplicationStatus.FAILED,
    });

    this.logger.log(
      `Application ${applicationId} updated → ${success ? 'APPLIED' : 'FAILED'}`,
    );
  }

  // ─────────────────────────────────────────────
  // 7. GET QUEUE STATUS
  // ─────────────────────────────────────────────
  async getQueueStatus() {
    const [waiting, active, failed, completed] = await Promise.all([
      this.applyQueue.getWaitingCount(),
      this.applyQueue.getActiveCount(),
      this.applyQueue.getFailedCount(),
      this.applyQueue.getCompletedCount(),
    ]);

    return { waiting, active, failed, completed };
  }

  // ─────────────────────────────────────────────
  // 8. GET GLOBAL QUEUE FOR STAFF
  // ─────────────────────────────────────────────
  async getGlobalQueue(status?: string, search?: string) {
    const query = this.applicationRepo.createQueryBuilder('app')
      .leftJoinAndSelect('app.client', 'client')
      .leftJoinAndSelect('app.job', 'job')
      .leftJoinAndSelect('app.resume', 'resume')
      .orderBy('app.applicationDate', 'DESC');

    if (status && status !== 'all') {
      query.andWhere('app.status = :status', { status });
    }

    if (search) {
      query.andWhere(
        '(job.company ILIKE :search OR job.title ILIKE :search OR client.firstName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const apps = await query.getMany();
    return apps.map(app => ({
      ...this.formatApplication(app),
      clientName: `${app.client?.firstName || 'Unknown'} ${app.client?.lastName || ''}`,
      clientId: app.client?.id
    }));
  }

  // ─────────────────────────────────────────────
  //   9. UPDATE APPLICATION DETAILS (INLINE EDIT)
  // ─────────────────────────────────────────────
  async updateApplicationDetails(id: string, updateData: Record<string, any>): Promise<any> {
    const dateFields = ['dueDate', 'dateLatestReply', 'interviewDates'];
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    let jobNeedsUpdate = false;
    let appNeedsUpdate = false;
    const appUpdatePayload: any = {};

    // 1. Map Job-Related Fields
    if (updateData.targetRole !== undefined && application.job) {
      application.job.title = updateData.targetRole;
      jobNeedsUpdate = true;
    }
    const jobFields = ['company', 'location', 'salaryRange'];
    jobFields.forEach((field) => {
      if (updateData[field] !== undefined && application.job) {
        application.job[field] = updateData[field];
        jobNeedsUpdate = true;
      }
    });

    // Save Job changes safely via entity manager
    if (jobNeedsUpdate && application.job) {
      await this.applicationRepo.manager.save(application.job);
    }

    // 2. Map Application-Related Fields
    const appFields = [
      'hours', 'dueDate', 'dateLatestReply', 'interviewDates', 
      'interviewStage', 'feedbackReceived', 'notes', 'cvUsed', 'coverLetterUsed', 'platform'
    ];
    
    appFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        let value = updateData[field];

        //   THE FIX: If it's a date field and it's empty/invalid, set to null
        if (dateFields.includes(field)) {
          if (!value || value === "" || value === "Invalid Date") {
            appUpdatePayload[field] = null;
          } else {
            appUpdatePayload[field] = value;
          }
        } else {
          appUpdatePayload[field] = value;
        }
        appNeedsUpdate = true;
      }
    });

    // Save Application changes
    if (appNeedsUpdate) {
      await this.applicationRepo.update(id, appUpdatePayload);
    }

    this.logger.log(`Application ${id} updated via inline editing`);
    return { message: `Application ${id} updated successfully` };
  }

  

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private formatApplication(app: ApplicationRecord) {
    return {
      id: app.id,
      applicationId: app.applicationId, 
      clientId: app.client?.id,
      targetRole: app.job?.title ?? 'Unknown',
      company: app.job?.company ?? 'Unknown',
      location: app.job?.location ?? 'Not specified',
      salaryRange: app.job?.salaryRange ?? 'Not specified',
      hours: app.hours,                 
      platform: app.platform,           
      dueDate: app.dueDate,             
      applicationDate: app.applicationDate,
      dateLatestReply: app.dateLatestReply, 
      weekApplied: app.weekApplied,     
      status: app.status,  
      atsScore: app.resume?.atsScore ?? 0,
      resumeId: app.resume?.id ?? null,
      cvUsed: app.cvUsed ?? (app.resume?.targetRole ? `${app.resume.targetRole} Resume` : null), 
      coverLetterUsed: app.coverLetterUsed, 
      jobUrl: app.job?.applyUrl ?? null, 
      jobDescription: app.job?.jobDescription || null,
      interviewDates: app.interviewDates,   
      interviewStage: app.interviewStage,   
      feedbackReceived: app.feedbackReceived, 
      notes: app.notes,                     
    };
  }

  private buildSummary(total: number, applications: ApplicationRecord[]) {
    return {
      total,
      applied: applications.filter(a => a.status === ApplicationStatus.APPLIED).length,
      pending: applications.filter(a =>
        [ApplicationStatus.PENDING, ApplicationStatus.PENDING_RESUME, ApplicationStatus.IN_PROGRESS].includes(a.status),
      ).length,
      waitingReview: applications.filter(
        a => a.status === ApplicationStatus.WAITING_REVIEW,
      ).length,
      interviews: applications.filter(a => a.status === ApplicationStatus.INTERVIEW).length,
      offers: applications.filter(a => a.status === ApplicationStatus.OFFER).length,
      failed: applications.filter(a => a.status === ApplicationStatus.FAILED).length,
    };
  } 

  private resolveMethod(atsType: string): AttemptMethod {
    if (atsType === 'greenhouse' || atsType === 'lever') {
      return AttemptMethod.API;
    }
    return AttemptMethod.BROWSER;
  }
}