import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../entities/job.entity';
import { Client } from '../../clients/entities/client.entity'; 
import { ApplicationRecord } from '../../applications/entities/application.entity';
import { ApplicationStatus } from '../../applications/enums/application-status.enum';
@Injectable() 
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ApplicationRecord)
    private applicationRepo: Repository<ApplicationRecord>,
  ) {}

  async runMatchMaker(clientId: string) {
    this.logger.log(`Initiating Job Fit Engine for client: ${clientId}`);

    // 1. Fetch the user and their ATS profile
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['profile'],
    });

    if (!client || !client.profile) {
      this.logger.warn('Client or profile not found. Cannot run matchmaker.');
      return null;
    }

    const targetRole = client.profile.targetRole?.toLowerCase() || '';
    const userSkills = client.profile.skills || [];

    // 2. Fetch all fresh jobs that haven't been applied to yet
    // (In production, you'd filter by date and avoid jobs they already applied to)
    const availableJobs = await this.jobRepo.find();
    let matchesFound = 0;

    // 3. The Scoring Engine
    for (const job of availableJobs) {
      let score = 0;
      const jobDesc = job.jobDescription?.toLowerCase() || '';
      const jobTitle = job.title.toLowerCase();

      // --- Metric A: Title Match (Max 40 points) ---
      if (targetRole && jobTitle.includes(targetRole)) {
        score += 40;
      } else {
        // Partial match (e.g., Target: "Software Engineer", Job: "Senior Software Engineer")
        const targetWords = targetRole.split(' ');
        const matchedWords = targetWords.filter(word => jobTitle.includes(word));
        score += (matchedWords.length / targetWords.length) * 30; // Up to 30 points for partial
      }

      // --- Metric B: Skill Keyword Match (Max 60 points) ---
      if (userSkills.length > 0) {
        let skillsFound = 0;
        userSkills.forEach(skill => {
          if (jobDesc.includes(skill.toLowerCase())) {
            skillsFound++;
          }
        });
        const skillPercentage = skillsFound / userSkills.length;
        score += Math.round(skillPercentage * 60);
      }

      // 4. The Threshold Decision (e.g., > 70 is a good fit)
      if (score >= 70) {
        this.logger.log(`High match found! Score: ${score} for Job: ${job.title}`);
        
        // Check if an application already exists so we don't duplicate
        const existingApp = await this.applicationRepo.findOne({
          where: { 
            client: { id: clientId },
            job: { id: job.id } // Requires a @ManyToOne relation to Job in application_records
          }
        });

        if (!existingApp) {
          //   FIX: Create the object separately to ensure TypeORM maps it correctly
          const appData = {
            client: client, // The Client entity we fetched at the start
            job: job,       // The Job entity from the loop
            targetRole: job.title,
            company: job.company,
            atsScore: score,
            //   FIX: Cast to 'any' to bypass the strict Enum overload mismatch
            status: ApplicationStatus.PENDING as any, 
          };

          const newApp = this.applicationRepo.create(appData);
          
          await this.applicationRepo.save(newApp);
          matchesFound++;
        }
      }
    }

    return { success: true, newMatches: matchesFound };
  }
}