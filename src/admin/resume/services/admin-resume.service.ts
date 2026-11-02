import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseResume } from '../entities/base-resume.entity';
import { ResumeValidatorService } from './validator-service';
import { ResumeParserService } from './parsing-service';
import { ResumeAtsService } from './scoring-service';
import { ResumeVersionService } from './versioning-service';
import { ResumeRenderService } from './render-service';
import { Client } from '../../../clients/entities/client.entity';
import { Admin } from '../../entities/admin.entity';

@Injectable()
export class AdminResumeService {
  private readonly logger = new Logger(AdminResumeService.name);

  constructor(
    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    private readonly validatorService: ResumeValidatorService,
    private readonly parserService: ResumeParserService,
    private readonly atsService: ResumeAtsService,
    private readonly versionService: ResumeVersionService,
    private readonly renderService: ResumeRenderService,
  ) {}

  // ─── A-03: PARSE CLIENT PDF ────────────────────────────────────────────────

  async parsePdf(
    clientId: string,
    adminEmail: string,
  ): Promise<Record<string, any>> {
    // Fetches the client's uploaded PDF from Supabase Storage,
    // sends it to Gemini, and returns the Atomic JSON draft.
    // Nothing is saved — admin reviews in the editor first.

    return this.parserService.parsePdfToAtomicJson(clientId, adminEmail);
  }

  // ─── A-05: CREATE BASE RESUME ──────────────────────────────────────────────

  async create(dto: {
    clientId: string;
    adminId: string;
    resumeName: string;
    resumeJson: Record<string, any>;
  }): Promise<BaseResume> {
    // Full creation flow:
    // 1. Validate client and admin exist
    // 2. Validate Atomic JSON structure
    // 3. Save to DB
    // 4. Calculate ATS baseline score
    // 5. Update record with score
    // 6. Return final saved record

    // ── Step 1: Verify client exists ─────────────────────────────────────────
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException(
        `Client with id ${dto.clientId} not found`,
      );
    }

    // ── Step 2: Verify admin exists ──────────────────────────────────────────
    const admin = await this.adminRepo.findOne({
      where: { id: dto.adminId },
    });

    if (!admin) {
      throw new NotFoundException(
        `Admin with id ${dto.adminId} not found`,
      );
    }

    // ── Step 3: Validate Atomic JSON ─────────────────────────────────────────
    this.validatorService.validate(dto.resumeJson);
    // Throws BadRequestException if JSON structure is invalid.
    // Nothing is saved if validation fails.

    // ── Step 4: Save to DB ───────────────────────────────────────────────────
    const resume = this.baseResumeRepo.create({
      resumeName: dto.resumeName,
      resumeJson: dto.resumeJson,
      version: 1,
      isActive: true,
      client,
      createdBy: admin,
    });

    const saved = await this.baseResumeRepo.save(resume);
    this.logger.log(`Base resume "${saved.resumeName}" saved with id ${saved.id}`);

    // ── Step 5: Calculate ATS baseline score ─────────────────────────────────
    // Done after save so we always have a record even if scoring fails.
    // Score is calculated asynchronously and updated on the record.
    try {
      const score = await this.atsService.calculateBaselineScore(dto.resumeJson);
      saved.atsBaselineScore = score;
      saved.resumeJson.metadata.atsBaselineScore = score;
      await this.baseResumeRepo.save(saved);
      this.logger.log(`ATS baseline score set to ${score} for resume ${saved.id}`);
    } catch (error) {
      // ATS scoring failure should not block the creation flow.
      // The resume is already saved — score can be recalculated later.
      this.logger.warn(
        `ATS scoring failed for resume ${saved.id} — score will be null`,
      );
    }

    return saved;
  }

  // ─── A-04: FETCH RESUME FOR EDITOR ────────────────────────────────────────

  async findById(id: string): Promise<BaseResume> {
    const resume = await this.baseResumeRepo.findOne({
      where: { id },
      relations: ['client', 'createdBy'],
    });

    if (!resume) {
      throw new NotFoundException(`Base resume with id ${id} not found`);
    }

    return resume;
  }

  // ─── FETCH ALL FOR CLIENT ──────────────────────────────────────────────────

  async findByClientId(clientId: string): Promise<BaseResume[]> {
    // Returns all active base resumes for a specific client.
    // Used in the admin dashboard to show all resume variants
    // available for a client.
    return this.baseResumeRepo.find({
      where: {
        client: { id: clientId },
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── UPDATE RESUME JSON ────────────────────────────────────────────────────

  async update(
    id: string,
    updatedJson: Record<string, any>,
  ): Promise<BaseResume> {
    // Admin edits a field in the Visual Resume Editor and saves.
    // Validates the updated JSON before saving.
    // Increments version and recalculates ATS score.

    const resume = await this.baseResumeRepo.findOne({ where: { id } });

    if (!resume) {
      throw new NotFoundException(`Base resume with id ${id} not found`);
    }

    // Validate updated JSON before saving
    this.validatorService.validate(updatedJson);

    // Increment version to track edit history
    resume.resumeJson = updatedJson;
    resume.version = resume.version + 1;

    const saved = await this.baseResumeRepo.save(resume);

    // Recalculate ATS score after update
    try {
      const score = await this.atsService.calculateBaselineScore(updatedJson);
      saved.atsBaselineScore = score;
      saved.resumeJson.metadata.atsBaselineScore = score;
      await this.baseResumeRepo.save(saved);
    } catch (error) {
      this.logger.warn(`ATS scoring failed after update for resume ${id}`);
    }

    return saved;
  }

  // ─── A-06: DUPLICATE RESUME ────────────────────────────────────────────────

  async duplicate(
    resumeId: string,
    newResumeName: string,
  ): Promise<BaseResume> {
    // Creates a clone of an existing base resume with a new name.
    // The clone is linked back to the original via parentResumeId.
    // Validates and saves the clone, then calculates its ATS score.

    // VersionService builds the unsaved duplicate entity
    const duplicate = await this.versionService.duplicate(
      resumeId,
      newResumeName,
    );

    // Validate the cloned JSON
    this.validatorService.validate(duplicate.resumeJson);

    // Save the duplicate
    const saved = await this.baseResumeRepo.save(duplicate);
    this.logger.log(
      `Resume duplicated: "${saved.resumeName}" (id: ${saved.id}) from parent ${saved.parentResumeId}`,
    );

    // Calculate ATS score for the duplicate
    try {
      const score = await this.atsService.calculateBaselineScore(
        saved.resumeJson,
      );
      saved.atsBaselineScore = score;
      saved.resumeJson.metadata.atsBaselineScore = score;
      await this.baseResumeRepo.save(saved);
    } catch (error) {
      this.logger.warn(`ATS scoring failed for duplicate resume ${saved.id}`);
    }

    return saved;
  }

  // ─── DELETE JSON ENTRY ─────────────────────────────────────────────────────

  async deleteJsonEntry(
    resumeId: string,
    entryId: string,
  ): Promise<BaseResume> {
    // Removes a specific node from the resume JSON by its id.
    // e.g. admin deletes a specific bullet point or job entry.
    // Validates the result and saves.

    const resume = await this.baseResumeRepo.findOne({ where: { id: resumeId } });

    if (!resume) {
      throw new NotFoundException(`Base resume with id ${resumeId} not found`);
    }

    // VersionService handles the JSON node removal
    const updatedJson = this.versionService.deleteJsonEntry(
      resume.resumeJson,
      entryId,
    );

    // Validate after removal to ensure structure is still intact
    this.validatorService.validate(updatedJson);

    resume.resumeJson = updatedJson;
    resume.version = resume.version + 1;

    return this.baseResumeRepo.save(resume);
  }

  // ─── SOFT DELETE ───────────────────────────────────────────────────────────

  async deactivate(id: string): Promise<BaseResume> {
    const resume = await this.baseResumeRepo.findOne({ where: { id } });

    if (!resume) {
      throw new NotFoundException(`Base resume with id ${id} not found`);
    }

    resume.isActive = false;
    return this.baseResumeRepo.save(resume);
  }

  // ─── RENDER PDF ────────────────────────────────────────────────────────────

  async renderPdf(resumeId: string): Promise<Buffer> {
    // Delegates to RenderService — returns raw PDF buffer.
    // Controller streams it as a file download.
    return this.renderService.renderPdfFromId(resumeId);
  }

  // ─── PREVIEW PDF ───────────────────────────────────────────────────────────

  async previewPdf(resumeJson: Record<string, any>): Promise<Buffer> {
    // Renders a PDF from raw JSON without saving.
    // Used for editor preview before the admin commits to saving.
    return this.renderService.renderPdfFromJson(resumeJson);
  }

  // ─── GET VERSION CHAIN ─────────────────────────────────────────────────────

  async getVersionChain(resumeId: string): Promise<BaseResume[]> {
    return this.versionService.getVersionChain(resumeId);
  }
}