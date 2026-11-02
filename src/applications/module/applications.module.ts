import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// ── Entities ───────────────────────────────────────────────────────
import { ApplicationRecord } from '../entities/application.entity';
import { ApplicationAttempt } from '../entities/application-attempts';
import { ReviewTask } from '../../review/entities/review-task.entity';
import { Client } from '../../clients/entities/client.entity';
import { ResumeVariant } from '../../resumes/entities/resume.entity';
import { Job } from '../../job/entities/job.entity';
import { SavedAnswer } from '../../saved-answers/entities/saved-answer.entity';

// ── Services ───────────────────────────────────────────────────────
import { ApplicationsService } from '../services/applications.service';
import { ApplicationOrchestratorService } from '../services/orchestrator';
import { PythonAutomationService } from '../services/automation/python-automation-service';
import { LlmMappingService } from '../services/llm-service/llm-mapping.service';
import { SavedAnswersService } from '../../saved-answers/services/saved-answers.service';

// ── ATS Adapters ───────────────────────────────────────────────────
import { GreenhouseAdapter } from '../services/adapters/greenhouse';
import { LeverAdapter } from '../services/adapters/lever';
import { WorkdayAdapter } from '../services/adapters/workday';
import { GenericCareerSiteAdapter } from '../services/adapters/generic';
import { AtsAdapterFactory } from '../services/adapters/factory/ats-adapter-factory';

// ── Queue Worker ───────────────────────────────────────────────────
import { ApplyQueueWorker } from '../queue/applyqueue.worker';

// ── Constants ──────────────────────────────────────────────────────
import { APPLY_QUEUE } from '../queue/queue.constants';

// ── Controllers ────────────────────────────────────────────────────
import { ApplicationsController } from '../controllers/applications.controller';
//   FIX: IMPORT THE MOCK ATS CONTROLLER HERE
import { MockAtsController } from '../controllers/mock-ats.controller';

//-- Needed to import QuotaModule too ----
import { QuotaModule } from '../../quota/quota.module';
//   FIX: IMPORT THE JOBS MODULE
import { JobsModule } from '../../job/module/job.module';

/**
 * APPLICATION ENGINE MODULE
 * ─────────────────────────────────────────────────────────────────
 * Wires together:
 * - TypeORM entity repositories (including SavedAnswer)
 * - BullMQ queue (apply_queue)
 * - ATS adapters + factory
 * - LLM mapping service (Claude)
 * - SavedAnswers service (answer cache)
 * - Python automation service
 * - Queue worker + orchestrator
 * - Applications service + controller
 * ─────────────────────────────────────────────────────────────────
 */
@Module({
  imports: [
    ConfigModule,

    TypeOrmModule.forFeature([
      ApplicationRecord,
      ApplicationAttempt,
      ReviewTask,
      Client,
      ResumeVariant,
      Job,
      SavedAnswer, 
    ]),

    BullModule.registerQueue({
      name: APPLY_QUEUE,
    }),

    HttpModule.register({
      timeout: 120_000,
      maxRedirects: 5,
    }),

    
    JobsModule,
    
    QuotaModule,
  ],

  providers: [
    // ── Core Services ────────────────────────────────────────────
    ApplicationsService,
    ApplicationOrchestratorService,
    PythonAutomationService,

    // ── LLM + Answer Cache ───────────────────────────────────────
    LlmMappingService,        // Calls Claude to map questions → answers
    SavedAnswersService,      // Caches answers so LLM isn't called for known questions

    // ── ATS Adapters ─────────────────────────────────────────────
    GreenhouseAdapter,        // Now injects LlmMappingService + SavedAnswersService
    LeverAdapter,
    WorkdayAdapter,
    GenericCareerSiteAdapter,

    // ── Adapter Factory ──────────────────────────────────────────
    AtsAdapterFactory,

    // ── Queue Worker ─────────────────────────────────────────────
    ApplyQueueWorker,
  ],

  controllers: [
    ApplicationsController,
    MockAtsController, //   FIX: REGISTER IT IN THE CONTROLLERS ARRAY!
  ],

  exports: [
    ApplicationsService,
    ApplicationOrchestratorService,
    PythonAutomationService,
    LlmMappingService,
    SavedAnswersService,
    AtsAdapterFactory,
  ],
})
export class ApplicationEngineModule {}