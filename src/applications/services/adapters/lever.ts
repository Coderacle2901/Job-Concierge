import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import {
  IAtsAdapter,
  CandidatePayload,
  JobPayload,
  AdapterSubmitResult,
} from '../adapters/interfaces/interfaces';

/**
 * LEVER ADAPTER
 * ─────────────────────────────────────────────────────────────────
 * Lever exposes a public Postings API for job listings and
 * application submissions.
 *
 * Submit endpoint:
 *   POST https://api.lever.co/v0/postings/{site}/{posting_id}/apply
 *
 * The site (company identifier) and posting_id are extracted from the job URL.
 *
 * Lever job URLs look like:
 *   https://jobs.lever.co/acme/abc123-uuid
 *   → site = acme, postingId = abc123-uuid
 *
 * Lever accepts multipart/form-data.
 * Docs: https://hire.lever.co/developer/postings
 * ─────────────────────────────────────────────────────────────────
 */
@Injectable()
export class LeverAdapter implements IAtsAdapter {
  private readonly logger = new Logger(LeverAdapter.name);

  private readonly API_BASE = 'https://api.lever.co/v0/postings';

  constructor(private readonly httpService: HttpService) {}

  // ─────────────────────────────────────────────
  // DETECT
  // ─────────────────────────────────────────────
  detect(jobUrl: string): boolean {
    return (
      jobUrl.includes('lever.co') ||
      jobUrl.includes('jobs.lever.co')
    );
  }

  supportsApiApply(): boolean {
    return true;
  }

  supportsBrowserApply(): boolean {
    return true;
  }

  requiredFields(): string[] {
    return ['firstName', 'lastName', 'email', 'cvFilePath'];
  }

  // ─────────────────────────────────────────────
  // MAP CANDIDATE
  // Lever uses "name" (full name), not first/last separately
  // ─────────────────────────────────────────────
  mapCandidate(
    candidate: CandidatePayload,
    job: JobPayload,
  ): Record<string, any> {
    return {
      name: `${candidate.firstName} ${candidate.lastName}`,
      email: candidate.email,
      phone: candidate.phone ?? '',
      org: '',                              // current company (optional)
      urls: {
        linkedin: candidate.linkedIn ?? '',
        portfolio: candidate.portfolio ?? '',
      },
      resume: candidate.cvFilePath,
      comments: '',                         // cover letter goes here if needed
      // Lever "cards" are custom question sets — extend later
    };
  }

  // ─────────────────────────────────────────────
  // SUBMIT APPLICATION
  // ─────────────────────────────────────────────
  async submitApplication(
    mappedPayload: Record<string, any>,
    job: JobPayload,
    candidate: CandidatePayload,
  ): Promise<AdapterSubmitResult> {
    try {
      const { site, postingId } = this.parseJobUrl(job.applyUrl);

      if (!site || !postingId) {
        this.logger.warn(`Cannot parse Lever URL: ${job.applyUrl}`);
        return {
          status: 'REQUIRES_REVIEW',
          reviewReason: 'APPROVAL_NEEDED',
          reviewPayload: {
            reason: 'Could not extract Lever site/posting ID from URL',
            url: job.applyUrl,
          },
          step: 'URL_PARSE',
        };
      }

      const endpoint = `${this.API_BASE}/${site}/${postingId}/apply`;
      this.logger.log(`Submitting to Lever API: ${endpoint}`);

      const form = new FormData();
      form.append('name', mappedPayload.name);
      form.append('email', mappedPayload.email);

      if (mappedPayload.phone) {
        form.append('phone', mappedPayload.phone);
      }

      if (mappedPayload.urls?.linkedin) {
        form.append('urls[linkedin]', mappedPayload.urls.linkedin);
      }

      if (mappedPayload.comments) {
        form.append('comments', mappedPayload.comments);
      }

      // Resume file stream
      if (mappedPayload.resume && fs.existsSync(mappedPayload.resume)) {
        const resumeStream = fs.createReadStream(mappedPayload.resume);
        const fileName = path.basename(mappedPayload.resume);
        form.append('resume', resumeStream, {
          filename: fileName,
          contentType: 'application/pdf',
        });
      }

      const response = await firstValueFrom(
        this.httpService.post(endpoint, form, {
          headers: { ...form.getHeaders() },
          timeout: 15000,
        }),
      );

      // Lever returns { applicationId: '...' } on success
      if (response.status === 200 || response.status === 201) {
        const confirmationNumber =
          response.data?.applicationId ?? response.data?.id ?? null;
        this.logger.log(`Lever application submitted. ID: ${confirmationNumber}`);
        return {
          status: 'SUCCESS',
          confirmationNumber,
        };
      }

      return {
        status: 'FAILED',
        failureReason: `Unexpected Lever response: ${response.status}`,
        step: 'API_SUBMIT',
      };
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? error?.message ?? 'Unknown error';
      this.logger.error(`Lever API submission failed: ${message}`);
      return {
        status: 'FAILED',
        failureReason: `Lever API error: ${message}`,
        step: 'API_SUBMIT',
      };
    }
  }

  async verifySubmission(confirmationNumber?: string): Promise<boolean> {
    return !!confirmationNumber;
  }

  async captureEvidence(): Promise<Record<string, any>> {
    return { method: 'lever_api', note: 'Confirmation captured from Lever API response' };
  }

  // ─────────────────────────────────────────────
  // PRIVATE: Parse Lever URL
  // https://jobs.lever.co/acme/abc123 → { site: 'acme', postingId: 'abc123' }
  // ─────────────────────────────────────────────
  private parseJobUrl(url: string): { site: string | null; postingId: string | null } {
    try {
      const match = url.match(/lever\.co\/([^\/]+)\/([^\/?\#]+)/);
      return {
        site: match?.[1] ?? null,
        postingId: match?.[2] ?? null,
      };
    } catch {
      return { site: null, postingId: null };
    }
  }
}