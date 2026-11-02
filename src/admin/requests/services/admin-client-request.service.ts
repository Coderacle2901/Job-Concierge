import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../../clients/entities/client.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { CandidateProfile } from '../../../profile/entities/candidate-profile.entity';
import { SupabaseService } from '../../../supabase/supabase.service';

@Injectable()
export class AdminClientRequestService {
  private readonly logger = new Logger(AdminClientRequestService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,

    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,

    private readonly supabaseService: SupabaseService,
  ) {}

  // ─── GET PENDING CLIENT REQUESTS ──────────────────────────────────────────

  async getPendingRequests() {
    // Returns all clients whose status is REVIEW.
    // These are clients who have signed up, uploaded their PDF,
    // and had their base resume auto-generated at signup.
    // They are waiting for admin review and approval before
    // gaining access to their dashboard.

    const clients = await this.clientRepo.find({
      where: { status: 'REVIEW' as any },
      order: { name: 'ASC' },
    });

    this.logger.log(`Found ${clients.length} pending client requests`);

    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      plan: client.planName,
      status: client.status,
    }));
  }

  // ─── GET CLIENT REVIEW DATA ────────────────────────────────────────────────

  async getClientReviewData(clientId: string) {
    // Fetches the two pieces of data the admin needs for the
    // two-panel review layout:
    //   LEFT PANEL  → PDF URL (original uploaded resume from Supabase Storage)
    //   RIGHT PANEL → Base Resume Atomic JSON (auto-generated at signup by Gemini)
    //
    // The admin compares both panels, makes corrections to the JSON,
    // then clicks Approve.

    // ── Fetch client ─────────────────────────────────────────────────────────
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    // ── Fetch candidate profile for PDF URL ──────────────────────────────────
    const profile = await this.profileRepo.findOne({
      where: { client: { id: clientId } },
    });

    if (!profile || !profile.resumeUrl) {
      throw new NotFoundException(
        `No uploaded PDF found for client ${clientId}. ` +
        `The client may not have completed their profile setup.`,
      );
    }

    // ── Fetch base resume created at signup ──────────────────────────────────
    // At signup, Tony's service creates exactly one base resume for the client.
    // We fetch the most recently created one for this client.
    const baseResume = await this.baseResumeRepo.findOne({
      where: {
        client: { id: clientId },
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!baseResume) {
      throw new NotFoundException(
        `No base resume found for client ${clientId}. ` +
        `The auto-generation at signup may have failed.`,
      );
    }

    this.logger.log(
      `Review data fetched for client ${clientId} — ` +
      `Resume: ${baseResume.resumeName}, PDF: ${profile.resumeUrl}`,
    );

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        status: client.status,
      },
      // PDF URL for the left panel — admin views the original uploaded resume
      pdfUrl: profile.resumeUrl,
      // Atomic JSON for the right panel — admin edits this in the Visual Editor
      baseResume: {
        id: baseResume.id,
        resumeName: baseResume.resumeName,
        resumeJson: baseResume.resumeJson,
        atsBaselineScore: baseResume.atsBaselineScore,
        version: baseResume.version,
      },
    };
  }

  // ─── APPROVE CLIENT ────────────────────────────────────────────────────────

  async approveClient(
    clientId: string,
    updatedResumeJson: Record<string, any>,
  ) {
    // Does three things atomically:
    // 1. Saves the updated/confirmed resume JSON to the BaseResume record
    // 2. Deletes the PDF from Supabase Storage (no longer needed)
    // 3. Sets client.status to APPROVED (unlocks dashboard access)
    //
    // If the admin made no changes, the JSON passed back is the same
    // as what was fetched — saving it is safe and idempotent.

    // ── Fetch client ─────────────────────────────────────────────────────────
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    // ── Fetch profile for PDF URL ────────────────────────────────────────────
    const profile = await this.profileRepo.findOne({
      where: { client: { id: clientId } },
    });

    if (!profile) {
      throw new NotFoundException(
        `Candidate profile not found for client ${clientId}`,
      );
    }

    // ── Fetch base resume ────────────────────────────────────────────────────
    const baseResume = await this.baseResumeRepo.findOne({
      where: {
        client: { id: clientId },
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!baseResume) {
      throw new NotFoundException(
        `No base resume found for client ${clientId}`,
      );
    }

    // ── Step 1: Save updated JSON to BaseResume ──────────────────────────────
    baseResume.resumeJson = updatedResumeJson;
    baseResume.version = baseResume.version + 1;

    // Update metadata inside the JSON to reflect approval timestamp
    if (baseResume.resumeJson.metadata) {
      baseResume.resumeJson.metadata.updatedAt = new Date().toISOString();
    }

    await this.baseResumeRepo.save(baseResume);
    this.logger.log(
      `Base resume updated for client ${clientId} (v${baseResume.version})`,
    );

    // ── Step 2: Delete PDF from Supabase Storage ─────────────────────────────
    // The PDF was only needed temporarily for admin review.
    // Once approved, we delete it to keep the storage bucket clean.
    if (profile.resumeUrl) {
      await this.deletePdfFromStorage(profile.resumeUrl);

      // Clear the resumeUrl from the profile since the file no longer exists
      profile.resumeUrl = "";
      await this.profileRepo.save(profile);
    }

    // ── Step 3: Set client status to APPROVED ────────────────────────────────
    // This unlocks the client's dashboard access.
    // Tony's auth flow checks client.status before granting dashboard access.
    (client as any).status = 'APPROVED';
    await this.clientRepo.save(client);

    this.logger.log(
      `Client ${clientId} approved — PDF deleted, status set to APPROVED`,
    );

    return {
      message: 'Client approved successfully',
      clientId,
      clientStatus: 'APPROVED',
      baseResumeId: baseResume.id,
      baseResumeVersion: baseResume.version,
    };
  }

  // ─── REJECT CLIENT ─────────────────────────────────────────────────────────

  async rejectClient(clientId: string, rejectionReason: string) {
    // Admin rejects the client request.
    // Sets client status to REJECTED with a reason.
    // PDF is also deleted since the client won't be onboarded.
    // Client will need to re-apply or contact support.

    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const profile = await this.profileRepo.findOne({
      where: { client: { id: clientId } },
    });

    // Delete PDF on rejection too — no longer needed
    if (profile?.resumeUrl) {
      await this.deletePdfFromStorage(profile.resumeUrl);
      profile.resumeUrl = "";
      await this.profileRepo.save(profile);
    }

    // Set status to REJECTED with reason
    (client as any).status = 'REJECTED';
    (client as any).rejectionReason = rejectionReason;
    await this.clientRepo.save(client);

    this.logger.log(`Client ${clientId} rejected — reason: ${rejectionReason}`);

    return {
      message: 'Client request rejected',
      clientId,
      clientStatus: 'REJECTED',
      rejectionReason,
    };
  }

  // ─── PRIVATE: DELETE PDF FROM STORAGE ────────────────────────────────────

  private async deletePdfFromStorage(resumeUrl: string): Promise<void> {
    // Extracts the file path from the public URL and deletes it
    // from the Supabase Storage resumes bucket.
    //
    // Public URL format:
    // https://xxx.supabase.co/storage/v1/object/public/resumes/userId-timestamp.pdf
    // We need to extract: userId-timestamp.pdf (the file path within the bucket)

    try {
      const supabase = this.supabaseService.getClient();

      // Extract the file path from the URL
      // Everything after /public/resumes/ is the file path
      const urlParts = resumeUrl.split('/public/resumes/');

      if (urlParts.length < 2) {
        this.logger.warn(
          `Could not extract file path from URL: ${resumeUrl}. Skipping delete.`,
        );
        return;
      }

      const filePath = urlParts[1];

      const { error } = await supabase.storage
        .from('resumes')
        .remove([filePath]);

      if (error) {
        // Log but don't throw — PDF deletion failure should not
        // block the approval flow. It can be cleaned up manually.
        this.logger.error(
          `Failed to delete PDF from storage: ${error.message}. ` +
          `File path: ${filePath}. Manual cleanup may be required.`,
        );
        return;
      }

      this.logger.log(`PDF deleted from storage: ${filePath}`);

    } catch (error: any) {
      this.logger.error(
        `Unexpected error deleting PDF: ${error.message}. Manual cleanup may be required.`,
      );
    }
  }
}