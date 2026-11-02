import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq'; 
import { Queue } from 'bullmq';  
import { ResumeVariant } from '../entities/resume.entity'; 
import { Client, ClientStatus } from '../../clients/entities/client.entity'; //   FIXED: Imported ClientStatus enum
import { GoogleGenerativeAI, Part } from '@google/generative-ai'; 
import * as puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import * as path from 'path';
import { calculateAtsScore } from '../utils/ats-scorer.util'; 
import { SupabaseService } from '../../supabase/supabase.service';
import { QuotaService } from '../../quota/quota.service'; 
import { ApplicationRecord } from '../../applications/entities/application.entity';
import { ApplicationStatus } from '../../applications/enums/application-status.enum';

@Injectable()
export class ResumeService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    @InjectRepository(ResumeVariant)
    private resumeRepo: Repository<ResumeVariant>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ApplicationRecord)
    private applicationRepo: Repository<ApplicationRecord>,
    private readonly supabaseService: SupabaseService,
    private readonly quotaService: QuotaService,
    @InjectQueue('resume-queue')
    private readonly resumeQueue: Queue,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // ==========================================
  // 1. THE PRODUCER (FAST HTTP RESPONSE)
  // ==========================================
  async queueResumeGeneration(
    userId: string, 
    targetRole: string,  
    jobDescription: string,
    jobId?: string,
    applicationId?: string
  ) {
    await this.quotaService.deductQuota(userId, 'GENERATE_RESUME');

    try {
      const job = await this.resumeQueue.add(
        'generate-resume', 
        { userId, targetRole, jobDescription, jobId, applicationId },
        { 
          attempts: 3, 
          backoff: { type: 'exponential', delay: 5000 } 
        }
      );

      this.logger.log(`Added resume generation to queue (Job ID: ${job.id}) for user ${userId}`);

      return { 
        message: "Resume generation queued successfully. AI is processing in the background.",
        jobId: job.id
      };

    } catch (error) {
      this.logger.error(`Queueing failed. Refunding 1 point to Client ${userId}`, error);
      await this.quotaService.refundQuota(userId, 'GENERATE_RESUME');
      throw new InternalServerErrorException('Failed to queue resume generation');
    }
  }

  // ==========================================
  // 2. THE HEAVY LIFTER (CALLED BY WORKER)
  // ==========================================
  async executeAIGeneration(jobData: any): Promise<ResumeVariant> {
    const { userId, targetRole, jobDescription, jobId, applicationId } = jobData;
    
    try {
      const client = await this.clientRepo.findOne({ 
        where: { id: userId },
        relations: ['profile'] 
      });
      
      if (!client) throw new NotFoundException('Client profile not found');

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" } 
      });

      const p = client.profile || ({} as any);

      //   NEW: Dynamic Seniority Calculation reading from your 'experienceYears' string
      let inferredSeniority = 'Junior/Entry-Level';
      const expStr = p.experienceYears || '0-2';
      
      if (expStr === '5+' || expStr === '10+') {
        inferredSeniority = 'Senior/Experienced';
      } else if (expStr === '3-5') {
        inferredSeniority = 'Mid-Level';
      } else {
        inferredSeniority = 'Junior/Entry-Level';
      }

      // Safe Name Fallback using your DB columns
      const clientName = client.name || [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Candidate';
      
      // Dynamic Focus Mapping
      const primaryFocus = p.currentRole || p.targetRole || p.industry || 'General Technology';

      const prompt = `
You are an elite ATS-Optimization AI for JobConcierge. Your task is to generate a highly tailored, ATS-beating resume by cross-referencing the user's [MASTER_PROFILE] with the [TARGET_ROLE] and the specific [JOB_DESCRIPTION].

CRITICAL ATS & FORMATTING RULES:
1. THE 80% METRIC RULE: At least 80% of all experience bullet points MUST contain a quantifiable metric (%, $, time saved, scale). 
2. ACTION VERB ENFORCEMENT: Every single bullet point MUST begin with a strong, past-tense action verb (e.g., Architected, Spearheaded, Orchestrated). No weak openers like "Helped with" or "Responsible for".
3. STRUCTURED SKILLS: Extract mandatory keywords from the [JOB_DESCRIPTION] and combine them with the user's skills. You MUST categorize them logically into Languages, Frameworks, Tools, and Core Competencies.
4. TAILORING RELEVANCE: Reorder the bullet points under each role so the achievements most relevant to the [JOB_DESCRIPTION] appear first. Naturally weave exact phrasing from the JD.
5. SENIORITY CONTEXT: This candidate is evaluated as [${inferredSeniority}]. Adjust the tone, complexity of verbs, and summary section to perfectly match this career stage.
 
INPUT DATA:
[TARGET_ROLE]: ${targetRole}
[JOB_ID]: ${jobId || 'N/A'}
[JOB_DESCRIPTION]: ${jobDescription}
[MASTER_PROFILE]: ${JSON.stringify({ 
  name: clientName,
  email: client.email,
  phone: p.phone,
  location: p.location,
  linkedin: p.linkedin,
  github: p.github || '', 
  portfolio: p.portfolio || '',
  skills: p.skills, 
  experience: p.experience,
  education: p.education,
  projects: p.projects,
  certifications: p.certifications,
  currentSeniorityLevel: inferredSeniority,
  primaryFocus: primaryFocus,
  workAuthorization: p.workAuthorization || 'Not specified'
})}

OUTPUT FORMAT:
Return ONLY valid JSON. Do not include markdown, conversational filler, or backticks. Structure exactly like this:
{
  "personalInfo": { 
    "name": "...", "role": "...", "email": "...", "phone": "...", "location": "...", "linkedin": "...", "github": "...", "portfolio": "..." 
  },
  "summary": "A 3-4 sentence powerful professional summary tailored to the target role...",
  "skills": {
    "languages": ["...", "..."],
    "frameworks": ["...", "..."],
    "tools": ["...", "..."],
    "coreCompetencies": ["...", "..."]
  },
  "experience": [
    { 
      "title": "...", 
      "company": "...", 
      "location": "...", 
      "dates": "Month Year - Month Year", 
      "bullets": ["Strong bullet with metric...", "..."] 
    }
  ],
  "education": [
    { "institution": "...", "degree": "...", "dates": "...", "location": "..." }
  ],
  "projects": [
    { "name": "...", "description": "...", "technologies": ["...", "..."], "link": "..." }
  ],
  "certifications": [
    { "name": "...", "issuer": "...", "date": "..." }
  ]
}
`;

      this.logger.log(`Generating AI JSON for ${targetRole} [Context: ${inferredSeniority}]...`);
      const result = await model.generateContent(prompt);
      
      //   NEW: Bulletproof JSON Cleaning to prevent parse crashes
      const rawAIResponse = result.response.text();
      const cleanedJson = rawAIResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      const tailoredResumeData = JSON.parse(cleanedJson);

      let flatKeywords: string[] = [];
      const rawSkills = tailoredResumeData.skills || tailoredResumeData.keywords;
      
      if (Array.isArray(rawSkills)) {
        flatKeywords = rawSkills; 
      } else if (typeof rawSkills === 'object' && rawSkills !== null) {
        flatKeywords = Object.values(rawSkills).flat() as string[];
      }

      const computedAtsScore = calculateAtsScore(tailoredResumeData, targetRole);

      this.logger.log(`Generating PDF Buffer...`);
      const pdfBuffer = await this.generatePdfBuffer(tailoredResumeData);

      const supabase = this.supabaseService.getClient();
      const cleanRole = targetRole.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fileName = `${userId}/${Date.now()}_${cleanRole}.pdf`;

      this.logger.log(`Uploading PDF to Supabase Storage: ${fileName}`);
      const { error: uploadError } = await supabase.storage
        .from('resume_pdfs') 
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        this.logger.error("Storage upload failed:", uploadError);
        throw new InternalServerErrorException("Failed to upload PDF to storage");
      }

      const { data: urlData } = supabase.storage
        .from('resume_pdfs')
        .getPublicUrl(fileName);
        
      const fileUrl = urlData.publicUrl;
      this.logger.log(`PDF saved securely at: ${fileUrl}`);

      const newResume = this.resumeRepo.create({
        client, 
        targetRole,
        atsScore: computedAtsScore, 
        keywords: flatKeywords, 
        content: tailoredResumeData,
        fileUrl: fileUrl, 
      });

      //   Save the resume first
      const savedResume = await this.resumeRepo.save(newResume);

      // ==========================================
      //   THE AUTOMATION BRIDGE (CLOSING THE LOOP)
      // ==========================================
      if (applicationId) {
        this.logger.log(`Finding application ${applicationId} to attach new resume...`);
        const app = await this.applicationRepo.findOne({ where: { id: applicationId } });
        
        if (app) {
          app.resume = savedResume; // Attach the shiny new AI resume!
          app.status = ApplicationStatus.PENDING; // Shift status to Ready to Apply
          await this.applicationRepo.save(app);
          this.logger.log(`Successfully linked Resume ${savedResume.id} to Application ${app.id} and set to PENDING.`);
        } else {
           this.logger.warn(`Could not find Application ${applicationId} to link to Resume!`);
        }
      }

      return savedResume;

    } catch (error) {
      this.logger.error(`AI Generation or Save error in worker:`, error);
      throw error; 
    }
  }

  // ==========================================
  // 3. UPDATE ENGINE
  // ==========================================
  async updateResumeContent(id: string, newContent: any): Promise<ResumeVariant> {
    const resume = await this.resumeRepo.findOne({ where: { id } });
    if (!resume) throw new NotFoundException('Resume not found');
    resume.content = newContent;
    
    return await this.resumeRepo.save(resume);
  }

  // ==========================================
  // 4. PUPPETEER PDF ENGINE
  // ==========================================
  async renderPdfFromId(id: string): Promise<Buffer> {
    const resume = await this.resumeRepo.findOne({ where: { id } });
    if (!resume || !resume.content) throw new NotFoundException('Resume content not found');

    const contentObj = typeof resume.content === 'string' 
      ? JSON.parse(resume.content) 
      : resume.content;

    return this.generatePdfBuffer(contentObj);
  }

  private async generatePdfBuffer(contentObj: any): Promise<Buffer> {
    const templatePath = path.join(process.cwd(), 'views', 'resume.ejs');
    
    this.logger.log("Rendering HTML via EJS...");
    const htmlString = await ejs.renderFile(templatePath, { ...contentObj });
    
    this.logger.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ] 
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlString as string, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  // ==========================================
  // 5. PDF UPLOAD PARSER & CLOUD SAVER (SIGNUP DECK  )
  // ==========================================
  async uploadAndParseResume(userId: string, file: any) {
    try {
      this.logger.log(`\n========== STARTING AI RESUME ENGINE FOR ${userId} ==========`);
      const supabase = this.supabaseService.getClient(); 

      const uniqueFileName = `${userId}-${Date.now()}.pdf`;
      this.logger.log(`Uploading ${uniqueFileName} to Supabase Storage...`);
      
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(uniqueFileName, file.buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase Upload Failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(uniqueFileName);
        
      const secureResumeUrl = publicUrlData.publicUrl;
      this.logger.log(`File uploaded successfully! URL: ${secureResumeUrl}`);

      this.logger.log(`Sending PDF buffer directly to Gemini Vision for parsing...`);

      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });

      const pdfPart: Part = {
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      };

      //   FIXED: Enhanced prompt structure to extract Summary, Phone, Location, and Core Professional anchors
      const extractionPrompt = `
You are an expert ATS system and technical recruiter. Extract the following information from the resume PDF to build a master candidate profile.
Return ONLY a valid JSON object matching this exact structure. If information is missing, return an empty string "" or empty array [] for that field.

{
  "personalInfo": {
    "phone": "Extracted phone number or empty string",
    "location": "Extracted location (City, Country or State)",
    "linkedin": "Extracted LinkedIn profile URL link",
    "github": "Extracted GitHub profile URL link",
    "portfolio": "Extracted portfolio or personal website link"
  },
  "summary": "A cohesive 3-4 sentence professional summary summarizing their core skills and career focus extracted from the resume content",
  "skills": ["Array of extracted technical and soft skills"],
  "experience": [
    { "title": "Job Title", "company": "Company Name", "location": "Location", "dates": "Start - End", "bullets": ["Accomplishment 1", "Accomplishment 2"] }
  ],
  "education": [
    { "institution": "School Name", "degree": "Degree Name", "dates": "Start - End", "location": "Location" }
  ],
  "projects": [
    { "name": "Project Name", "description": "Project details", "technologies": ["Tech 1", "Tech 2"] }
  ],
  "certifications": ["Certification 1", "Certification 2"]
}
`;

      const result = await model.generateContent([extractionPrompt, pdfPart]);
      const rawAIResponse = result.response.text();

      const cleanedJson = rawAIResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanedJson);

      const client = await this.clientRepo.findOne({
        where: { id: userId },
        relations: ['profile']
      });

      if (!client) {
        throw new NotFoundException('Client not found. Cannot save resume data.');
      }

      if (!client.profile) {
        this.logger.log(`Profile relation missing. Initializing new profile object...`);
        client.profile = {} as any; 
      }

      // Populate extracted items cleanly into your database columns
      client.profile.skills = parsedData.skills?.length ? parsedData.skills : null;
      client.profile.experience = parsedData.experience?.length ? parsedData.experience : null;
      client.profile.education = parsedData.education?.length ? parsedData.education : null;
      client.profile.projects = parsedData.projects?.length ? parsedData.projects : null;
      client.profile.certifications = parsedData.certifications?.length ? parsedData.certifications : null;
      
      //   FIXED: Save newly mapped fields to candidate profile context properties
      client.profile.summary = parsedData.summary || null;
      client.profile.phone = parsedData.personalInfo?.phone || null;
      client.profile.location = parsedData.personalInfo?.location || null;
      client.profile.linkedin = parsedData.personalInfo?.linkedin || null;
      client.profile.github = parsedData.personalInfo?.github || null;
      client.profile.portfolio = parsedData.personalInfo?.portfolio || null;
      
      client.profile.resumeUrl = secureResumeUrl; 

      //   FIXED: Shift Client status to 'REVIEW' so it appears on the admin panel dashboard immediately!
      client.status = ClientStatus.REVIEW;

      this.logger.log(`Saving to database with cloud URL and advancing status to REVIEW...`);
      await this.clientRepo.save(client);
      this.logger.log(`\n========== SUCCESSFULLY SAVED DB RECORD FOR ${userId} ==========\n`);

      return {
        message: 'Resume successfully uploaded to cloud, parsed by Gemini Vision, and saved!',
        resumeUrl: secureResumeUrl,
        extractedData: parsedData
      };

    } catch (error: any) {
      this.logger.error('\n❌❌❌ FATAL RESUME PROCESS ERROR ❌❌❌');
      this.logger.error(error.message || error);
      this.logger.error(error.stack);
      throw new InternalServerErrorException('Failed to process and save resume with AI & Cloud Engine');
    }
  }

  // ==========================================
  //   6. NEW: BULLMQ JOB STATUS BRIDGE
  // ==========================================
  async getJobStatus(jobId: string) {
    const job = await this.resumeQueue.getJob(jobId);
    
    if (!job) {
      throw new NotFoundException(`Background job with ID ${jobId} not found`);
    }

    const state = await job.getState();
    const failedReason = job.failedReason;
    const returnvalue = job.returnvalue;

    return {
      jobId: job.id,
      state,
      failedReason,
      result: returnvalue 
    };
  }
}