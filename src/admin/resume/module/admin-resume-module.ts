import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../../module/admin.module'; // ← add this import
import { BaseResume } from '../entities/base-resume.entity';
import { ResumeValidatorService } from '../services/validator-service';
import { ResumeParserService } from '../services/parsing-service';
import { ResumeAtsService } from '../services/scoring-service';
import { ResumeVersionService } from '../services/versioning-service';
import { ResumeRenderService } from '../services/render-service';
import { AdminResumeService } from '../services/admin-resume.service';
import { AdminResumeController } from '../controllers/controller';
import { CandidateProfile } from '../../../profile/entities/candidate-profile.entity';
import { Client } from '../../../clients/entities/client.entity';
import { Admin } from '../../../admin/entities/admin.entity';

@Module({
  imports: [ 
    TypeOrmModule.forFeature([
      BaseResume,
      CandidateProfile,
      Client,
      Admin,
    ]),
     forwardRef(() => AdminModule)
  ],
  controllers: [AdminResumeController],
  providers: [
    ResumeValidatorService,
    ResumeParserService,
    ResumeAtsService,
    ResumeVersionService,
    ResumeRenderService,
    AdminResumeService,
  ],
  exports: [
    ResumeValidatorService,
    ResumeParserService,
    ResumeAtsService,
    ResumeVersionService,
    ResumeRenderService,
    AdminResumeService,
  ],
})
export class AdminResumeModule {}