import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../../clients/entities/client.entity';
import { StaffAssignment } from '../../../staff/entities/staff-assignment.entity';
import { ApplicationRecord } from '../../../applications/entities/application.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AdminDashboardController } from '../controllers/admin-dashboard.controller';
import { AdminAssignmentModule } from '../../staff/module/admin-assignment.module';
import { AdminModule } from '../../module/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      StaffAssignment,
      ApplicationRecord,
      BaseResume,
    ]),
    AdminAssignmentModule,
    // AdminAssignmentModule imported so AdminDashboardService
    // can inject AdminAssignmentService for syncOverdueAssignments()
    forwardRef(() => AdminModule),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}