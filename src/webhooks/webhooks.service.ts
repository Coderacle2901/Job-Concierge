// src/webhooks/webhooks.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ResumeVariant } from '../resumes/entities/resume.entity';
import { ResumeParsedDto } from './dto/resume-parsed.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(ResumeVariant) private resumeRepo: Repository<ResumeVariant>,
  ) {}

  async processParsedResume(payload: ResumeParsedDto) {
    // 1. Create the new Client (Jane Smith) based on the AI data
    const newClient = this.clientRepo.create({
      name: payload.clientName,
      planName: payload.planName,
      totalQuota: 100, // E.g., Gold plan quota
      remainingQuota: 100,
    });
    const savedClient = await this.clientRepo.save(newClient);

    // 2. Create her first AI-generated Resume Variant
    const newResume = this.resumeRepo.create({
      id: `RES-${uuidv4().substring(0, 8)}`, // Generate a unique ID like RES-a1b2c3d4
      targetRole: payload.targetRole,
      atsScore: payload.initialAtsScore,
      usedInApps: 0,
      client: savedClient, // Link it to Jane!
    });
    await this.resumeRepo.save(newResume);

    return {
      message: 'Client and Master Resume successfully generated',
      clientId: savedClient.id, // We return this so we know her ID!
    };
  }
}