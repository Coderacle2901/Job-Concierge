import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../entities/admin.entity';
import { AdminService } from '../services/admin-service';
import { AdminController } from '../controllers/admin.controller';
import { AdminGuard } from '../guard/admin.gaurd';
import { SupabaseModule } from '../../supabase/supabase.module';
import { AdminResumeModule } from '../resume/module/admin-resume-module';
import { AdminStaffModule } from '../staff/module/admin-staff.module';
import { AdminAssignmentModule } from '../staff/module/admin-assignment.module';
import { AdminClientRequestModule } from '../requests/module/admin-client-request.module';
import { AdminDashboardModule } from '../dashboard/module/admin-dashboard.module';

import { Client } from '../../clients/entities/client.entity';
import { Staff } from '../../staff/entities/staff.entity'; // path to your new Staff entity
@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Client, Staff]),
    SupabaseModule,
     forwardRef(() => AdminResumeModule), // ← import the resume module to use its services in admin controllersbut 
     AdminStaffModule, 
     AdminAssignmentModule,
      AdminClientRequestModule,
      AdminDashboardModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService, AdminGuard],
  // AdminService and AdminGuard are exported so other modules
  // (clients, staff, assignments) can protect their routes
  // using @UseGuards(AdminGuard) without re-declaring dependencies.
}) 
export class AdminModule {}
