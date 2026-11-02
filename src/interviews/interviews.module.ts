// src/interviews/interviews.module.ts
import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { SupabaseModule } from '../supabase/supabase.module'; // 👈 Import this

@Module({
  imports: [SupabaseModule], // 👈 Add it here so the service can use it
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}