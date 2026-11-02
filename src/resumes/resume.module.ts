import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Client } from '../clients/entities/client.entity'; 
import { ResumeVariant } from './entities/resume.entity';
import { QuotaModule } from '../quota/quota.module';
import { ResumeService } from './services/resumes.service';
import { ResumeController } from './controllers/resume.controller';
import { ResumeProcessor } from './resume.processor';
import { SupabaseService } from '../supabase/supabase.service'; //   IMPORT SUPABASE
import {ApplicationRecord} from "../applications/entities/application.entity"; 

@Module({
  imports: [
    TypeOrmModule.forFeature([ResumeVariant, Client, ApplicationRecord]),
    QuotaModule,
    BullModule.registerQueue({
      name: 'resume-queue',
    }),
  ], 
  controllers: [ResumeController],
  //   THE FIX: Register the Processor and SupabaseService here!
  providers: [ResumeService, ResumeProcessor, SupabaseService],
  exports: [ResumeService], 
})
export class ResumeModule {}