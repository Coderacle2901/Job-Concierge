import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, ClientStatus } from '../clients/entities/client.entity'; 
import { CandidateProfile } from './entities/candidate-profile.entity'; 
import { EmailService } from '../email/email.service'; 

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(CandidateProfile)
    private profileRepo: Repository<CandidateProfile>, 
    private emailService: EmailService, 
  ) {}

  async getProfile(clientId: string) {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['profile', 'resumes'] 
    });

    if (!client) throw new NotFoundException('Client not found');

    const p = client.profile || ({} as Partial<CandidateProfile>);

    return {
      firstName: client.firstName || client.name?.split(' ')[0] || '',
      lastName: client.lastName || client.name?.split(' ')[1] || '',
      email: client.email,
      status: client.status, 
      rejectionReason: client.rejectionReason || null,
      
      resumeUrl: p.resumeUrl || null, 
      
      phone: p.phone || '',
      location: p.location || '',
      currentRole: p.currentRole || '',
      targetRole: p.targetRole || '',
      industry: p.industry || 'Technology',
      experienceYears: p.experienceYears || '0-2',
      remotePreference: p.remotePreference || 'Hybrid',
      minSalary: p.minSalary || '',
      startDate: p.startDate || 'flexible',
      linkedIn: p.linkedin || '',
      portfolio: p.portfolio || '',
      
      github: p.github || '',
      workAuthorization: p.workAuthorization || 'Not specified',
      skills: p.skills || [],
      experience: p.experience || [],
      education: p.education || [],
      projects: p.projects || [],
      certifications: p.certifications || [],
      
      plan: {
        name: client.planName || 'Launchpad',
        nextBilling: "April 9, 2026", 
        features: ["AI Resume Optimization", "Priority Support"]
      },
      resumes: client.resumes?.map(r => ({
        id: r.id,
        name: r.targetRole || 'Resume_Document.pdf',
        atsScore: r.atsScore,
        status: "Active"
      })) || []
    };
  }

  // ==========================================
  //   STANDARD PROFILE UPDATE (No Status Changes/Emails)
  // ==========================================
  async updateProfile(clientId: string, data: any) {
    const client = await this.clientRepo.findOne({ 
      where: { id: clientId },
      relations: ['profile'] 
    });
    
    if (!client) throw new NotFoundException('Client not found');

    let profile = client.profile;
    if (!profile) {
      profile = this.profileRepo.create({ client: { id: clientId } });
    }

    if (data.firstName !== undefined) client.firstName = data.firstName;
    if (data.lastName !== undefined) client.lastName = data.lastName;
    client.name = `${client.firstName || ''} ${client.lastName || ''}`.trim();

    if (data.phone !== undefined) profile.phone = data.phone;
    if (data.location !== undefined) profile.location = data.location;
    if (data.currentRole !== undefined) profile.currentRole = data.currentRole;
    if (data.targetRole !== undefined) profile.targetRole = data.targetRole;
    if (data.industry !== undefined) profile.industry = data.industry;
    if (data.experienceYears !== undefined) profile.experienceYears = data.experienceYears;
    if (data.remotePreference !== undefined) profile.remotePreference = data.remotePreference;
    if (data.minSalary !== undefined) profile.minSalary = data.minSalary;
    if (data.startDate !== undefined) profile.startDate = data.startDate;
    if (data.linkedin !== undefined) profile.linkedin = data.linkedin; 
    if (data.portfolio !== undefined) profile.portfolio = data.portfolio;

    if (data.github !== undefined) profile.github = data.github;
    if (data.workAuthorization !== undefined) profile.workAuthorization = data.workAuthorization;
    if (data.skills !== undefined) profile.skills = data.skills;
    if (data.experience !== undefined) profile.experience = data.experience;
    if (data.education !== undefined) profile.education = data.education;
    if (data.projects !== undefined) profile.projects = data.projects;
    if (data.certifications !== undefined) profile.certifications = data.certifications;

    // Bulletproof save for standard updates
    await this.profileRepo.save(profile);
    await this.clientRepo.save(client);

    return this.getProfile(clientId);
  }

  // ==========================================
  //   PROCESS FULL 5-STEP INTAKE PAYLOAD
  // ==========================================
  async processIntake(clientId: string, payload: any) {
    this.logger.log(`Processing intake form for Client: ${clientId}`);

    // 1. Fetch the client and their profile
    const client = await this.clientRepo.findOne({ 
      where: { id: clientId },
      relations: ['profile'] 
    });
    
    if (!client) throw new NotFoundException('Client not found');

    // 2. Ensure the CandidateProfile object exists
    let profile = client.profile;
    if (!profile) {
      profile = this.profileRepo.create({ client: { id: clientId } });
    }

    // 3. Map Step 1 (Personal Info)
    let updatedFirstName = client.firstName;
    let updatedLastName = client.lastName;
    let updatedName = client.name;

    if (payload.fullName) {
      const nameParts = payload.fullName.split(' ');
      updatedFirstName = nameParts[0];
      updatedLastName = nameParts.slice(1).join(' ');
      updatedName = payload.fullName;
    }
    
    profile.phone = payload.phone;
    profile.location = `${payload.cityState}, ${payload.country}`;

    // 4. Map Step 2 (Career & Preferences)
    profile.targetRole = payload.targetJobRoles;
    profile.minSalary = payload.targetSalary;
    profile.workAuthorization = payload.workAuthorization;
    profile.remotePreference = payload.workType && Array.isArray(payload.workType) ? payload.workType.join(', ') : 'Hybrid';
    profile.industry = payload.industries && Array.isArray(payload.industries) ? payload.industries.join(', ') : 'Technology';

    //   THE NEW MAPPINGS
    profile.employmentStatus = payload.employmentStatus;

    // Smart logic for Preferred Locations mapping
    if (payload.targetLocations === 'Any Location') {
      profile.preferredLocations = ['Any Location'];
    } else if (payload.desiredStates) {
      // If they typed specific states, split them by comma into a proper Postgres array
      profile.preferredLocations = payload.desiredStates
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else {
      profile.preferredLocations = [];
    }

    // 5. Map Step 3 (Access & Credentials)
    profile.linkedin = payload.linkedInUrl;

    //   BULLETPROOF SAVE #1: Save the Profile explicitly!
    await this.profileRepo.save(profile);
    this.logger.log(`Candidate Profile explicitly saved for ${clientId}`);

    // 6. Handle the Gatekeeper Flag & Status Upgrade
    let newStatus = client.status;
    if (client.status === ClientStatus.INCOMPLETE) {
      newStatus = ClientStatus.REVIEW;
      this.logger.log(`Client ${clientId} upgraded to REVIEW status.`);
      
      const clientName = updatedFirstName || updatedName || 'Client';
      
      try {
        this.emailService.notifyAdminsNewClient(clientName, profile.targetRole);
        this.emailService.sendClientWelcomeReceipt(client.email, clientName, profile.targetRole);
      } catch (e) {
        this.logger.error("Email notification failed, but intake continuing...", e);
      }
    }

    //   BULLETPROOF SAVE #2: Use .update() to FORCE Postgres to change the boolean
    await this.clientRepo.update(clientId, {
      firstName: updatedFirstName,
      lastName: updatedLastName,
      name: updatedName,
      hasCompletedIntake: true, 
      status: newStatus
    });

    this.logger.log(`Intake successfully completed and Gatekeeper unlocked for Client: ${clientId}`);

    return { 
      message: 'Intake processed successfully',
      status: newStatus,
      hasCompletedIntake: true
    };
  }
}