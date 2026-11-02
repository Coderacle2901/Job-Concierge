import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// AnalyticsController import removed to avoid module resolution error when the controller file is missing.
import { AnalyticsService } from './analytics.service';
import { ApplicationRecord } from '../applications/entities/application.entity';
import { Client } from '../clients/entities/client.entity';
import { Staff } from '../staff/entities/staff.entity';
import { StaffAssignment } from '../staff/entities/staff-assignment.entity';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApplicationRecord,
      Client,
      Staff,
      StaffAssignment,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}