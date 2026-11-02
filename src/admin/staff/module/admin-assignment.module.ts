import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffAssignment } from '../../../staff/entities/staff-assignment.entity';
import { Staff } from '../../../staff/entities/staff.entity';
import { Client } from '../../../clients/entities/client.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { AdminAssignmentService } from '../services/admin-assignment.service';
import { AdminAssignmentController } from '../controllers/admin-assignment.controller';
import { AdminModule } from '../../module/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffAssignment,
      Staff,
      Client,
      BaseResume,
    ]),
    forwardRef(() => AdminModule),
  ],
  controllers: [AdminAssignmentController],
  providers: [AdminAssignmentService],
  exports: [AdminAssignmentService],
})
export class AdminAssignmentModule {}