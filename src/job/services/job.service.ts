import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, AtsType } from '../entities/job.entity';
import { detectAtsType } from '../utils/ats-dectector';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
  ) {}

  // ================================================
  // Used by ApplicationService — fetch job by ID
  // and auto-detect atsType if still on default
  // ================================================
  async getJobById(id: string): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    // If Scout saved it with default "browser",
    // try to detect the real ATS type from the URL
    if (job.atsType === AtsType.BROWSER) {
      const detected = detectAtsType(job.applyUrl);

      if (detected !== AtsType.BROWSER) {
        job.atsType = detected;
        await this.jobRepo.update(id, { atsType: detected });
        this.logger.log(
          `Auto-detected atsType for job ${id}: ${detected}`
        );
      }
    }

    return job;
  }

  //Used by the client to create new Jobs.
  async createCustomJob(dto: { 
  title: string; 
  company: string; 
  location?: string;
  applyUrl: string; 
  description?: string; 
  atsType?: string 
}) {
  
  const job = this.jobRepo.create({
    title: dto.title,
    company: dto.company,
    applyUrl: dto.applyUrl,
    jobDescription: dto.description || 'Custom request',
    source: 'manual',
    atsType: 'manual',
    datePosted: new Date(),
    isManualEntry: true // Pro-tip: useful flag to distinguish from scraped jobs
  });

  return this.jobRepo.save(job);
}

  // ================================================
  // Used by staff dashboard — show all available
  // jobs scraped by Scout
  // ================================================
  async getAllJobs(): Promise<Job[]> {
    return this.jobRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  // ================================================
  // Used internally if atsType needs a manual update
  // ================================================
  async updateAtsType(id: string, atsType: AtsType): Promise<void> {
    await this.jobRepo.update(id, { atsType });
    this.logger.log(`Updated atsType for job ${id} → ${atsType}`);
  }
}