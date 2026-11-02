import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ResumeService } from './services/resumes.service';
import { QuotaService } from '../quota/quota.service';
import { SupabaseService } from '../supabase/supabase.service';

@Processor('resume-queue')
export class ResumeProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeProcessor.name);

  constructor(
    private readonly resumeService: ResumeService,
    private readonly quotaService: QuotaService,
    private readonly supabaseService: SupabaseService, //   INJECT SUPABASE
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name} for user ${job.data.userId}...`);

    try {
      // 1. Call the heavy AI logic
      const newResume = await this.resumeService.executeAIGeneration(job.data);
      this.logger.log(`✅ Job ${job.id} completed. Resume saved!`);

      //   2. SEND SUCCESS NOTIFICATION
      const supabase = this.supabaseService.getClient();
      const { error: notifError } = await supabase.from('notifications').insert([{
        user_id: job.data.userId,
        title: `Resume Ready: ${job.data.targetRole}`,
        message: `Your AI-tailored resume is ready to use! Head over to your Resume Versions page to view or download it.`,
        type: 'resume', // You can use this type on the frontend to show a document icon
        is_read: false
      }]);

      if (notifError) {
        this.logger.error(`Failed to send success notification for Job ${job.id}:`, notifError);
      }

      return newResume;

    } catch (error) {
      this.logger.error(`❌ Job ${job.id} failed attempt ${job.attemptsMade} of ${job.opts.attempts}`);
      throw error; // Rethrow so BullMQ triggers a retry
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    // If all retries are exhausted
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      this.logger.error(`🚨 Job ${job.id} permanently failed after ${job.attemptsMade} attempts. Refunding Quota!`);
      
      //   1. REFUND THE QUOTA
      await this.quotaService.refundQuota(job.data.userId, 'GENERATE_RESUME');
       
      //   2. SEND FAILURE NOTIFICATION
      const supabase = this.supabaseService.getClient();
      await supabase.from('notifications').insert([{
        user_id: job.data.userId,
        title: `Resume Generation Failed ❌`,
        message: `We hit a snag generating your resume for ${job.data.targetRole}. Don't worry, 1 point has been refunded to your wallet!`,
        type: 'alert', // Use this type on the frontend to show a red warning icon
        is_read: false
      }]);
    }
  }
}