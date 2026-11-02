/**
 * ATS ADAPTER INTERFACE
 * ─────────────────────────────────────────────────────────────────
 * Every ATS adapter (Greenhouse, Lever, Workday, Generic, etc.)
 * must implement this contract.
 *
 * The orchestrator calls these methods without knowing which ATS
 * it's talking to. Swap adapters freely — the orchestrator doesn't care.
 * ─────────────────────────────────────────────────────────────────
 */

export interface CandidatePayload {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  portfolio?: string;
  address?: string;
  workAuthorization?: string;
  requiresSponsorship?: boolean;
  salaryExpectation?: number | string;
  cvFilePath: string;
  resumeUrl?: string;
  savedAnswers?: Record<string, string>;

  //   ADDED: Structured data for skill/experience matching
  resumeContent?: {
    skills?: string[];
    summary?: string | null;
    experience?: Array<{
      title?: string;
      company?: string;
      duration?: string;
      description?: string;
      technologies?: string[];
    }>;
    education?: Array<{
      degree?: string;
      institution?: string;
      year?: string;
    }>;
    certifications?: string[];
    totalYearsExperience?: number | null;
  };

  //   ADDED: Candidate preferences for behavioral/logistics matching
  preferences?: {
    remoteOnly?: boolean;
    willingToRelocate?: boolean;
    openToOnsiteRoles?: boolean;
    noticePeriod?: string | null;
    currentSalary?: number | null;
    preferredTools?: string[];
      preferredLocations?: string[]; // NEW field for location preferences
  };
}

export interface JobPayload {
  id: string;
  url: string;
  applyUrl: string;
  title: string;
  company: string;
  atsType: string;
  externalJobId?: string;
  // Cached questions from job ingestion (JSONB column).
  // Populated when job was fetched with fetchDetail: true.
  // GreenhouseAdapter reads this first before calling the Greenhouse API.
  questions?: any[] | null;
}

export interface AdapterSubmitResult {
  status: 'SUCCESS' | 'FAILED' | 'REQUIRES_REVIEW';
  confirmationNumber?: string | null;
  screenshotUrl?: string | null;
  failureReason?: string | null;
  reviewReason?: 'CAPTCHA' | 'UNKNOWN_QUESTION' | 'ESSAY_REQUIRED' | 'APPROVAL_NEEDED';
  reviewPayload?: Record<string, any>;
  step?: string;
}

export interface IAtsAdapter {
  detect(jobUrl: string): boolean;
  supportsApiApply(): boolean;
  supportsBrowserApply(): boolean;
  requiredFields(): string[];
  mapCandidate(candidate: CandidatePayload, job: JobPayload): Record<string, any>;
  submitApplication(
    mappedPayload: Record<string, any>,
    job: JobPayload,
    candidate: CandidatePayload,
  ): Promise<AdapterSubmitResult>;
  verifySubmission?(confirmationNumber?: string): Promise<boolean>;
  captureEvidence?(): Promise<Record<string, any>>;
}