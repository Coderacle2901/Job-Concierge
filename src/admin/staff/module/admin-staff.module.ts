import { Module, forwardRef } from '@nestjs/common';
import { StaffModule } from '../../../staff/staff.module';
import { AdminStaffService } from '../services/admin-staff.service';
import { AdminStaffController } from '../controllers/admin-staff.controller';
import { SupabaseModule } from '../../../supabase/supabase.module';
import { AdminModule } from '../../module/admin.module';

@Module({
  imports: [
    StaffModule,
    // StaffModule owns Staff + StaffAssignment entities and exports
    // TypeOrmModule — so @InjectRepository(Staff) works in AdminStaffService
    // without re-registering the entity here.
    SupabaseModule,
    forwardRef(() => AdminModule),
    // forwardRef breaks the circular dependency between
    // AdminModule and AdminStaffModule.
  ],
  controllers: [AdminStaffController],
  providers: [AdminStaffService],
  exports: [AdminStaffService],
})
export class AdminStaffModule {}

