import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { CandidatePayload } from '../adapters/interfaces/interfaces';

export interface FlatQuestion {
  name: string;
  label: string;
  type: string;
  required: boolean;
  values: Array<{ value: number | string; label: string }>;
}

export type LlmMappedAnswers = Record<string, string | null>;

// ----------------------------------------------------------
// Centralised junk set — used in BOTH the cache-hit check
// (mapQuestions) and the persist filter (GreenhouseAdapter).
// Export it so GreenhouseAdapter can import and reuse it.
// ----------------------------------------------------------
export const JUNK_ANSWERS = new Set([
  'null',
  'undefined',
  '',
  'not provided',
  'not specified',
  'not available',
  'not applicable',
  'n/a',
  'none',
  'unknown',
  'unspecified',
]);

@Injectable()
export class LlmMappingService {
  private readonly logger = new Logger(LlmMappingService.name);
  private readonly model: GenerativeModel;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 2048,
      },
    });
  }

  async mapQuestions(
    questions: FlatQuestion[],
    candidate: CandidatePayload,
    currentJobCache: Record<string, string> = {},
  ): Promise<LlmMappedAnswers> {
    if (questions.length === 0) return {};

    const alreadyAnswered: LlmMappedAnswers = {};
    const needsLlm: FlatQuestion[] = [];

    for (const q of questions) {
      const cachedValue = currentJobCache[q.name];
      // Use the shared JUNK_ANSWERS set — catches "not provided", "not specified", etc.
      const isJunk =
        !cachedValue ||
        JUNK_ANSWERS.has(String(cachedValue).toLowerCase().trim());

      if (!isJunk) {
        alreadyAnswered[q.name] = cachedValue;
      } else {
        needsLlm.push(q);
      }
    }

    if (needsLlm.length === 0) return alreadyAnswered;

    const llmAnswers = await this.callGemini(needsLlm, candidate);
    return { ...alreadyAnswered, ...llmAnswers };
  }

  private async callGemini(
    questions: FlatQuestion[],
    candidate: CandidatePayload,
  ): Promise<LlmMappedAnswers> {
    const prompt = this.buildPrompt(questions, candidate);
    try {
      const result = await this.model.generateContent(prompt);
      return this.parseResponse(result.response.text(), questions);
    } catch (error: any) {
      this.logger.error(`Gemini Mapping Error: ${error.message}`);
      return Object.fromEntries(questions.map(q => [q.name, null]));
    }
  }

  private buildPrompt(questions: FlatQuestion[], candidate: CandidatePayload): string {

      this.logger.log(`Candidate payload received: ${JSON.stringify({
    linkedIn: candidate.linkedIn,
    salaryExpectation: candidate.salaryExpectation,
    noticePeriod: candidate.preferences?.noticePeriod,
    preferredTools: candidate.preferences?.preferredTools,
    address: candidate.address,
  })}`)
    // ----------------------------------------------------------
    // Build a rich, unambiguous profile so Gemini has no excuse
    // to hedge. Every known field is surfaced explicitly.
    // ----------------------------------------------------------
    const profileContext = {
      personal: {
        fullName: `${candidate.firstName} ${candidate.lastName}`,
        preferredFirstName: candidate.firstName,
        email: candidate.email,
        phone: candidate.phone ?? null,
        address: candidate.address ?? null,
        links: {
          // Spell out the full URL so Gemini doesn't need to infer
          linkedIn: candidate.linkedIn ?? null,
          portfolio: candidate.portfolio ?? null,
        },
      },
      legal: {
        workAuthorization: candidate.workAuthorization ?? null,
        requiresSponsorship: candidate.requiresSponsorship ?? false,
        // Surface salary as both raw number and formatted string
        salaryExpectation: candidate.salaryExpectation ?? null,
        salaryFormatted: candidate.salaryExpectation
          ? `$${Number(candidate.salaryExpectation).toLocaleString()} USD`
          : null,
      },
      career: {
        summary: candidate.resumeContent?.summary ?? null,
        totalYearsExperience: candidate.resumeContent?.totalYearsExperience ?? 0,
        skills: candidate.resumeContent?.skills ?? [],
        experience: candidate.resumeContent?.experience ?? [],
        education: candidate.resumeContent?.education ?? [],
        certifications: candidate.resumeContent?.certifications ?? [],
      },
      preferences: {
        // noticePeriod is now always resolved (startDate fallback applied upstream)
        noticePeriod: candidate.preferences?.noticePeriod ?? null,
        remoteOnly: candidate.preferences?.remoteOnly ?? false,
        willingToRelocate: candidate.preferences?.willingToRelocate ?? false,
        openToOnsiteRoles: candidate.preferences?.openToOnsiteRoles ?? true,
        currentSalary: candidate.preferences?.currentSalary ?? null,
        // preferredTools might be empty — Gemini must infer from skills/experience
        preferredTools: candidate.preferences?.preferredTools ?? [],
        preferredLocations: candidate.preferences?.preferredLocations ?? [],
      },
    };

    const formSchema = questions.map(q => ({
      id: q.name,
      label: q.label,
      type: q.type,
      required: q.required,
      options: q.values?.map(v => v.label) ?? [],
    }));
  this.logger.log(`Form schema sent to Gemini: ${JSON.stringify(formSchema, null, 2)}`);
  
    return `You are a precise career automation agent filling out a job application form.
Map the Candidate Profile to every field in the Form Schema.

FORM SCHEMA:
${JSON.stringify(formSchema, null, 2)}

CANDIDATE PROFILE:
${JSON.stringify(profileContext, null, 2)}

====================================================================
CRITICAL RULES — READ EVERY RULE BEFORE ANSWERING:
====================================================================

1. **NULL MEANS SKIP — NEVER USE PLACEHOLDER STRINGS**
   If you cannot find a real answer, return null for that field.
   NEVER return "Not specified", "Not provided", "N/A", "Unknown", or any
   similar placeholder. These corrupt the cache and break future runs.

2. **LinkedIn / URLs**
   The candidate's LinkedIn URL is at profile.personal.links.linkedIn.
   Copy it verbatim. Do not invent or truncate.

3. **Salary**
   Use profile.legal.salaryExpectation (the number) or profile.legal.salaryFormatted
   (the formatted string). Pick whichever matches the field type (number input vs text).

4. **Notice Period / Availability**
   Use profileContext.preferences.noticePeriod exactly as given.
   e.g. "Available immediately", "2 weeks", "1 month".

5. **AI / Developer Tools**
   If profileContext.preferences.preferredTools is non-empty → use it.
   If it is empty → scan profileContext.career.skills and profileContext.career.experience
   for any mention of AI tools, IDEs, or developer tools (GitHub Copilot,
   ChatGPT, Claude, Cursor, VS Code, IntelliJ, etc.).
   Return the best matching tool name as a plain string.
   If you truly find nothing → return null (not a placeholder string).

6. **Select / Dropdown fields**
   The answer MUST exactly match one of the strings in the "options" array.
   Do not paraphrase. If no option fits, return null.

7. **Sponsorship**
   requiresSponsorship = true  → "Yes"
   requiresSponsorship = false → "No"

8. **Preferred First Name**
   Use profile.personal.preferredFirstName.

9. **Location**
   Use profile.personal.address for city/location questions.

10. **Behavioral / Open-ended questions**
    Reason through profile.career.experience to compose a concise answer.
    Return null only if there is genuinely no relevant experience to draw from.

====================================================================
OUTPUT FORMAT:
Return ONLY a single flat JSON object.
Keys = field "id" from the Form Schema.
Values = string answers or null.
No markdown, no code fences, no extra keys.
====================================================================`;
  }

  private parseResponse(
    content: string,
    questions: FlatQuestion[],
  ): LlmMappedAnswers {
    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      const parsed = JSON.parse(content.substring(start, end + 1));

      const result: LlmMappedAnswers = {};
      for (const q of questions) {
        const raw = parsed[q.name];
        // Treat Gemini's own placeholder strings as null at parse time too
        const isJunk =
          raw === undefined ||
          raw === null ||
          JUNK_ANSWERS.has(String(raw).toLowerCase().trim());
        result[q.name] = isJunk ? null : String(raw);
      }
      return result;
    } catch {
      return Object.fromEntries(questions.map(q => [q.name, null]));
    }
  }
}