import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../auth/auth.module'; //   IMPORT THE AUTH MODULE
import { Client } from '../clients/entities/client.entity';
import { ApplicationRecord } from '../applications/entities/application.entity';
import { ResumeVariant } from '../resumes/entities/resume.entity';

@Module({
  imports: [
    AuthModule, //   Give the Dashboard access to the JWT Guards
    TypeOrmModule.forFeature([Client, ApplicationRecord, ResumeVariant]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}