import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; 
import { ReviewTask } from '../review/entities/review-task.entity';
import { SavedAnswer } from '../saved-answers/entities/saved-answer.entity';
import { Client, ClientStatus } from '../clients/entities/client.entity'; 
import { ApplicationRecord } from '../applications/entities/application.entity';
import { ApplicationStatus } from '../applications/enums/application-status.enum';
import { ResumeVariant } from '../resumes/entities/resume.entity';
import { QuotaService } from '../quota/quota.service';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private reviewTaskRepo: Repository<ReviewTask>,
    @InjectRepository(SavedAnswer)
    private savedAnswerRepo: Repository<SavedAnswer>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ApplicationRecord)
    private applicationRepo: Repository<ApplicationRecord>,
    @InjectRepository(ResumeVariant)
    private resumeRepo: Repository<ResumeVariant>,
    private readonly quotaService: QuotaService,
  ) {} 

  // ==========================================
  // 1. Fetch unified dashboard data for Staff
  // ==========================================
  async getPendingTasks() {
    this.logger.log('Fetching unified dashboard data for Staff');
    
    // 1. Fetch Clients
    const clients = await this.clientRepo.find({
      relations: ['profile']
    });
    
    // Filter clients specifically waiting for Base Resume Review
    const reviewQueue = clients.filter(c => c.status === ClientStatus.REVIEW);
    
    // 2. Fetch ALL applications (Using QueryBuilder to force LEFT JOINS so NULLs aren't dropped)
    const allApplications = await this.applicationRepo.createQueryBuilder('application')
      .leftJoinAndSelect('application.client', 'client')
      .leftJoinAndSelect('application.job', 'job')
      .leftJoinAndSelect('application.attempts', 'attempts')
      .leftJoinAndSelect('application.resume', 'resume') //   ADDED: So resumeReady checks work!
      .orderBy('application.applicationDate', 'DESC')
      .getMany();

    // 3. Fetch ALL Resumes 
    const allResumes = await this.resumeRepo.find({
      relations: ['client'],
      order: { id: 'DESC' } 
    });

    // 4. Fetch Pending Review Tasks for the HITL Queue
    const pendingReviewTasks = await this.reviewTaskRepo.find({
      where: { status: 'pending' as any }
    });

    this.logger.log(`[DEBUG] FOUND ${allApplications.length} TOTAL APPS | ${allResumes.length} TOTAL RESUMES`);

    //   BUILD HITL QUEUE
    const hitlQueue = allApplications
      .filter(app => String(app.status).toUpperCase() === 'FAILED')
      .map(app => {
        const lastAttempt = app.attempts?.[0]; 
        const rTask = pendingReviewTasks.find(rt => rt.applicationId === app.id);

        return {
          applicationId: app.id,
          clientName: app.client?.name || 'Unknown',
          jobTitle: app.job?.title || 'Unknown Role',
          company: app.job?.company || 'Unknown Company',
          failureReason: lastAttempt?.failureReason || rTask?.payload?.reason || 'Automation Service Unavailable',
          attemptedAt: lastAttempt?.attemptedAt || app.applicationDate,
          browserUrl: app.job?.applyUrl,
          method: lastAttempt?.method || 'UNKNOWN',
          step: lastAttempt?.step || 'UNKNOWN',
          nextStep: lastAttempt?.nextStep || 'NONE',
          reviewTask: rTask ? {
            payload: rTask.payload,
            requiresUserInput: rTask.requiresUserInput,
            taskType: rTask.taskType
          } : null
        };
      });

    //   BUILD REAL APPLICATION QUEUE
    const realApplicationQueue = allApplications
      .filter(app => {
        //   BULLETPROOF FILTER: Uppercase it and rip out all spaces, underscores, and dashes!
        // This regex leaves ONLY the letters A-Z.
        const safeStatus = String(app.status || '').toUpperCase().replace(/[^A-Z]/g, '');
        
        return [
          'PENDING', 
          'PENDINGRESUME', // <--- This will now flawlessly match 'pending_resume', 'pending-resume', or ' pending_resume '
          'INPROGRESS',    // Matches 'in_progress' or 'in progress'
          'WAITINGREVIEW', 
          'FAILED'
        ].includes(safeStatus);
      })
      .map(app => {
        const lastAttempt = app.attempts?.[0];
        
        return {
          id: app.id,
          client: app.client?.name || 'Unknown Client',
          role: app.job?.title || 'Unknown Role',
          jobUrl: app.job?.applyUrl || '#', 
          resumeReady: !!app.resume, 
          coverLetter: true, 
          vpnState: "Active", 
          status: app.status,
          method: lastAttempt?.method || 'BROWSER',
          screenshotUrl: lastAttempt?.screenshotUrl || null,
          confirmationNumber: lastAttempt?.confirmationNumber || null,
        };
      });

    //   BUILD RESUME QUEUE
    const realResumeQueue = allResumes.map(r => ({
      id: r.id,
      clientId: r.client?.id, 
      client: r.client?.name || 'Unknown Client',
      jobTitle: r.targetRole || 'General Resume',
      fitScore: Math.max(70, r.atsScore - 5), 
      keywords: r.keywords || ["React", "NestJS", "TypeScript"],
      jobDescription: "Standard industry application.", 
    }));

    //   BUILD ATS QA QUEUE
    const realAtsQueue = allResumes
      .filter(r => r.atsScore < 90)
      .map(r => ({
        id: r.id,
        client: r.client?.name || 'Unknown Client',
        role: r.targetRole || 'General Resume',
        atsScore: r.atsScore,
        missingKeywords: ["Metrics", "Leadership", "Scalability"], 
        suggestions: "Expand on measurable outcomes using the STAR method."
      }));

    //   CALCULATE EXACT STATS FOR RECHARTS
    const clientStatsMap: Record<string, { Resumes: number, Applications: number, Failed: number }> = {};

    allApplications.forEach(app => {
      const cName = app.client?.name || 'Unknown';
      if (!clientStatsMap[cName]) clientStatsMap[cName] = { Resumes: 0, Applications: 0, Failed: 0 };

      clientStatsMap[cName].Applications += 1;

      if (String(app.status).toUpperCase() === 'FAILED') {
        clientStatsMap[cName].Failed += 1;
      }
    });

    realResumeQueue.forEach(r => {
      const cName = r.client;
      if (!clientStatsMap[cName]) clientStatsMap[cName] = { Resumes: 0, Applications: 0, Failed: 0 };
      clientStatsMap[cName].Resumes += 1;
    });

    const trueClientStats = Object.entries(clientStatsMap).map(([name, stats]) => ({
      name: name.split(' ')[0], 
      fullName: name,
      Resumes: stats.Resumes,
      Applications: stats.Applications,
      Failed: stats.Failed
    }));

    //   GLOBAL STATS FOR TOP CARDS
    const globalStats = {
      totalClients: clients.length,
      totalPendingResumes: realResumeQueue.length,
      totalPendingApps: realApplicationQueue.length,
      totalHitlAlerts: hitlQueue.length
    };

    return {
      reviewQueue, 
      workQueue: clients.map(c => {
        const clientAppCount = realApplicationQueue.filter(a => a.client === c.name).length;
        const clientResumeCount = realResumeQueue.filter(r => r.client === c.name).length;

        return {
          id: c.id,
          client: c.name,
          plan: c.planName || 'launchpad',
          appsDueToday: clientAppCount, 
          pendingResumes: clientResumeCount, 
          sla: c.planName === 'gold' ? 'urgent' : 'on-track'
        };
      }),
      resumeQueue: realResumeQueue, 
      atsQueue: realAtsQueue, 
      applicationQueue: realApplicationQueue,
      hitlQueue: hitlQueue,
      trueClientStats,
      globalStats
    };
  }

  // ==========================================
  // 2. Resolve a Task
  // ==========================================
  async resolveTask(taskId: string, staffId: string, resolutionPayload: any) {
    const task = await this.reviewTaskRepo.findOne({ where: { id: taskId } });
    
    if (!task) {
        const app = await this.applicationRepo.findOne({ where: { id: taskId } });
        if (app) {
            app.status = ApplicationStatus.APPLIED;
            await this.applicationRepo.save(app);
            this.logger.log(`Staff ${staffId} manually marked Application ${taskId} as APPLIED`);
            return { message: "Application manually marked as successful!" };
        }
        throw new NotFoundException(`Task or Application ${taskId} not found`);
    }
    
    if (String(task.status).toUpperCase() === 'RESOLVED') {
      throw new BadRequestException('Task is already resolved');
    }

    if (task.taskType === ('UNKNOWN_QUESTION' as any) && resolutionPayload?.saveToLibrary) {
      const client = await this.clientRepo.findOne({ where: { id: resolutionPayload.userId } });
      if (client) {
        const newAnswer = this.savedAnswerRepo.create({
          client: client, 
          questionName: task.payload?.questionId || `manual_${Date.now()}`, 
          questionLabel: task.payload?.questionText || 'Unknown Question', 
          answer: resolutionPayload.providedAnswer, 
          source: 'review_resolution' as any, 
          atsType: 'greenhouse' 
        });

        await this.savedAnswerRepo.save(newAnswer);
        this.logger.log(`Saved new answer to library for user ${client.id}`);
      }
    }

    task.status = 'resolved' as any;
    task.assignedStaffId = staffId;
    
    task.payload = {
      ...(task.payload || {}),
      resolvedAt: new Date(),
      resolution: resolutionPayload
    };

    await this.reviewTaskRepo.save(task);

    if (task.applicationId) {
      const app = await this.applicationRepo.findOne({ where: { id: task.applicationId } });
      if (app) {
        app.status = ApplicationStatus.APPLIED;
        await this.applicationRepo.save(app);
      }
    }

    return { message: "Task resolved successfully" };
  }

  // ==========================================
  // 3. Mark Task as Failed & Refund Quota
  // ==========================================
  async failAndRefundTask(taskId: string, staffId: string, staffReason?: string) {
    let task = await this.reviewTaskRepo.findOne({ where: { id: taskId } });
    let appId = task ? task.applicationId : taskId;

    const app = await this.applicationRepo.findOne({ 
      where: { id: appId },
      relations: ['client'] 
    });

    if (!app) {
      throw new NotFoundException(`Application ${appId} not found`);
    }

    if (String(app.status).toUpperCase() === 'APPLIED') {
      throw new BadRequestException('Cannot refund an application that was already marked APPLIED');
    }

    app.status = ApplicationStatus.CANCELLED; 
    await this.applicationRepo.save(app);

    if (task) {
      task.status = 'failed' as any;
      task.assignedStaffId = staffId;
      task.payload = {
        ...(task.payload || {}),
        resolvedAt: new Date(),
        resolution: "Staff marked as un-applyable and refunded.",
        staffReason: staffReason || "No specific reason provided."
      };
      await this.reviewTaskRepo.save(task);
    }

    if (app.client && app.client.id) {
      this.logger.log(`Staff ${staffId} triggering refund for Client ${app.client.id} (App: ${app.id})`);
      await this.quotaService.refundQuota(app.client.id, 'SUBMIT_APPLICATION');
    }

    return { message: "Application cancelled and 1 point refunded to client." };
  }

  // ==========================================
  //   APPROVE OR REJECT CLIENT BASE RESUME
  // ==========================================
  async evaluateClientResume(clientId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) {
    
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    await this.clientRepo.update(clientId, {
      status: status as any,
      rejectionReason: status === 'REJECTED' ? (rejectionReason || 'Your resume did not meet our system requirements.') : null
    });

    this.logger.log(`Client ${clientId} base resume was ${status}`);

    return { 
      message: `Client status successfully updated to ${status}`,
      clientId, 
      status
    };
  }
}