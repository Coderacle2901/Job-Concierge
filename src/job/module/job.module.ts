import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { Job } from '../entities/job.entity';
import { Client } from '../../clients/entities/client.entity';
import { ApplicationRecord } from '../../applications/entities/application.entity';

import { JobsService } from '../services/job.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { GreenhouseFetchService } from '../services/greenhouse.fetch.service';
import { GreenhouseQuestionsService } from '../services/greenhouse.question.service';
import { JobIngestionOrchestrator } from '../services/job.ingestion.service';

import { JobsController } from '../controllers/job.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Client, ApplicationRecord]),

    // HttpModule needed by GreenhouseFetchService and GreenhouseQuestionsService
    // to make HTTP calls to the Greenhouse public API
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
  ],

  controllers: [JobsController],

  providers: [
    // ── Existing ─────────────────────────────────────────────────
    JobsService,
    MatchingEngineService,

    // ── Job ingestion ─────────────────────────────────────────────
    GreenhouseFetchService,        // Fetches + stores jobs from Greenhouse API
    GreenhouseQuestionsService,    // Fetches + caches questions per job
    JobIngestionOrchestrator,      // Orchestrates which platform service to call
    // LeverFetchService,           // ← add when Lever ingestion is built
  ],

  exports: [
    JobsService,
    MatchingEngineService,
    GreenhouseQuestionsService,    // Exported so GreenhouseAdapter can use it
    JobIngestionOrchestrator,
  ],
})
export class JobsModule {}
