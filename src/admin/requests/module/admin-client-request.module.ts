import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../../clients/entities/client.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { CandidateProfile } from '../../../profile/entities/candidate-profile.entity';
import { AdminClientRequestService } from '../services/admin-client-request.service';
import { AdminClientRequestController } from '../controllers/admin-client-request.controller';
import { SupabaseModule } from '../../../supabase/supabase.module';
import { AdminModule } from '../../module/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      BaseResume,
      CandidateProfile,
    ]),
    SupabaseModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [AdminClientRequestController],
  providers: [AdminClientRequestService],
  exports: [AdminClientRequestService],
})
export class AdminClientRequestModule {}