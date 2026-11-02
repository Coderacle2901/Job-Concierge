import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { ReviewTask } from '../review/entities/review-task.entity';
import { SavedAnswer } from '../saved-answers/entities/saved-answer.entity';
import { Client } from '../clients/entities/client.entity';
import { ApplicationRecord } from '../applications/entities/application.entity';
import { ResumeVariant } from '../resumes/entities/resume.entity';
import { QuotaModule } from '../quota/quota.module';
import { StaffAssignment } from './entities/staff-assignment.entity';
import { Staff } from './entities/staff.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewTask,
      SavedAnswer,
      Client,
      ApplicationRecord,
      ResumeVariant,
      StaffAssignment,
      Staff,
    ]),
    QuotaModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [
    StaffService,
    TypeOrmModule,
    // Exporting TypeOrmModule makes the Staff and StaffAssignment
    // repositories available to any module that imports StaffModule.
    // This is the standard NestJS pattern for sharing entity repositories
    // across modules without re-registering them.
  ],
})
export class StaffModule {}