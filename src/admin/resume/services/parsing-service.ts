

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { CandidateProfile } from '../../../profile/entities/candidate-profile.entity';
import { Client } from '../../../clients/entities/client.entity';

@Injectable()
export class ResumeParserService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(ResumeParserService.name);

  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    // We inject CandidateProfile repo so we can fetch the client's
    // resumeUrl — the public Supabase Storage URL to their uploaded PDF.
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────

  async parsePdfToAtomicJson(
    clientId: string,
    adminEmail: string,
  ): Promise<Record<string, any>> {
    // Step 1: Fetch the client's candidate profile to get their resumeUrl
    // Step 2: Download the PDF from Supabase Storage via the public URL
    // Step 3: Send PDF buffer to Gemini with Atomic JSON prompt
    // Step 4: Normalize ids in the returned JSON
    // Step 5: Return draft Atomic JSON to the controller
    //
    // Nothing is saved here — this is purely a transformation operation.
    // The admin reviews the draft in the Visual Resume Editor before saving.

    // ── Step 1: Get client profile ───────────────────────────────────────────
    const profile = await this.profileRepo.findOne({
      where: { client: { id: clientId } as any },
      relations: ['client'],
    });

    if (!profile) {
      throw new NotFoundException(
        `Candidate profile not found for client ${clientId}`,
      );
    }

    if (!profile.resumeUrl) {
      throw new BadRequestException(
        'This client has not uploaded a resume yet. ' +
        'Ask the client to upload their PDF resume before parsing.',
      );
    }

    // ── Step 2: Download PDF from Supabase Storage ───────────────────────────
    this.logger.log(`Fetching PDF from Supabase Storage: ${profile.resumeUrl}`);

    const pdfBuffer = await this.fetchPdfFromUrl(profile.resumeUrl);

    // ── Step 3: Send to Gemini ───────────────────────────────────────────────
    this.logger.log(
      `Sending PDF to Gemini for client ${clientId}...`,
    );

    const rawJson = await this.callGemini(pdfBuffer, adminEmail);

    // ── Step 4: Normalize ids ────────────────────────────────────────────────
    const normalizedJson = this.normalizeIds(rawJson);

    this.logger.log(
      `PDF successfully parsed into Atomic JSON draft for client ${clientId}`,
    );

    return normalizedJson;
  }

  // ─── FETCH PDF FROM PUBLIC URL ─────────────────────────────────────────────

  private async fetchPdfFromUrl(url: string): Promise<Buffer> {
    // Downloads the PDF from Supabase Storage using the public URL.
    // Since the bucket is public, no auth headers are needed.
    // We use native fetch (available in Node 18+) to get the raw bytes.

    const response = await fetch(url);

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to fetch PDF from storage. Status: ${response.status}. ` +
        `URL: ${url}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  // ─── GEMINI CALL ───────────────────────────────────────────────────────────

  private async callGemini(
    fileBuffer: Buffer,
    adminEmail: string,
  ): Promise<Record<string, any>> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
      // responseMimeType: 'application/json' instructs Gemini to return
      // pure JSON only — no markdown, no explanation, no backticks.
    });

    const pdfPart: Part = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const prompt = this.buildPrompt(adminEmail);

    try {
      const result = await model.generateContent([prompt, pdfPart]);
      const rawResponse = result.response.text();

      // Strip residual markdown fences as a safety measure
      const cleanedResponse = rawResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(cleanedResponse);

    } catch (error: any) {
      this.logger.error('Gemini PDF parsing failed:', error.message);

      if (error instanceof SyntaxError) {
        throw new InternalServerErrorException(
          'Gemini returned malformed JSON. Please try again.',
        );
      }

      throw new InternalServerErrorException(
        `Failed to parse PDF with AI: ${error.message}`,
      );
    }
  }

  // ─── PROMPT BUILDER ────────────────────────────────────────────────────────

  private buildPrompt(adminEmail: string): string {
    const now = new Date().toISOString();

    return `
You are an expert resume parser for the JobConcierge platform. 
Extract all content from the attached PDF resume and return it structured 
EXACTLY in the Atomic JSON format below.

CRITICAL RULES:
1. Every node must have a unique "id" field using this pattern: "section_name_index" (e.g. "name_1", "job_1", "bullet_1_1")
2. Every text value must be its own separate "text" node with its own formatting object
3. Metrics and key achievements (numbers, percentages, $ values) must be separate bold text nodes with color "#2c7a7b"
4. If a section is missing from the PDF, include the section with an empty children array
5. Infer formatting from context: names are larger/bold, section headers are bold with borderBottom, body text is fontSize 11
6. Repeat job entries, bullet lists, education entries, and skill categories for ALL content in the PDF
7. Return ONLY valid JSON — no markdown, no explanation, no backticks

ATOMIC JSON FORMAT:
{
  "metadata": {
    "version": "2.0",
    "resumeName": "Base Resume - [Candidate Full Name]",
    "createdAt": "${now}",
    "updatedAt": "${now}",
    "createdBy": "${adminEmail}",
    "atsBaselineScore": null
  },
  "personalInfo": {
    "type": "section",
    "id": "personal_info_1",
    "children": [
      {
        "type": "text",
        "id": "name_1",
        "value": "[EXTRACTED FULL NAME]",
        "formatting": { "fontFamily": "Poppins", "fontSize": 28, "bold": true, "color": "#1a365d", "letterSpacing": 2, "alignment": "center", "marginTop": 20, "marginBottom": 5 }
      },
      {
        "type": "text",
        "id": "title_1",
        "value": "[EXTRACTED CURRENT TITLE OR TARGET ROLE]",
        "formatting": { "fontFamily": "Inter", "fontSize": 14, "color": "#4a5568", "alignment": "center", "marginBottom": 15 }
      },
      {
        "type": "contactRow",
        "id": "contact_1",
        "layout": "flex",
        "justifyContent": "center",
        "gap": 20,
        "children": [
          { "type": "text", "value": "[EMAIL]", "formatting": { "fontSize": 11, "fontFamily": "Inter", "color": "#718096" } },
          { "type": "text", "value": "•", "formatting": { "fontSize": 11, "color": "#cbd5e0" } },
          { "type": "text", "value": "[PHONE]", "formatting": { "fontSize": 11, "fontFamily": "Inter", "color": "#718096" } },
          { "type": "text", "value": "•", "formatting": { "fontSize": 11, "color": "#cbd5e0" } },
          { "type": "link", "value": "[LINKEDIN URL TEXT]", "url": "[LINKEDIN FULL URL]", "formatting": { "fontSize": 11, "color": "#3182ce", "textDecoration": "none" } }
        ]
      }
    ]
  },
  "professionalSummary": {
    "type": "section",
    "id": "summary_section_1",
    "title": "PROFESSIONAL SUMMARY",
    "titleFormatting": { "fontFamily": "Montserrat", "fontSize": 14, "bold": true, "color": "#2d3748", "borderBottom": "2px solid #3182ce", "marginTop": 10, "marginBottom": 8 },
    "children": [
      {
        "type": "paragraph",
        "id": "summary_text_1",
        "children": [
          { "type": "text", "value": "[EXTRACTED SUMMARY — if no summary exists, write a brief one from the experience]", "formatting": { "fontSize": 11, "fontFamily": "Inter" } }
        ]
      }
    ]
  },
  "workExperience": {
    "type": "section",
    "id": "experience_section_1",
    "title": "WORK EXPERIENCE",
    "titleFormatting": { "fontFamily": "Montserrat", "fontSize": 14, "bold": true, "borderBottom": "1px solid #cbd5e0", "marginTop": 15, "marginBottom": 8 },
    "children": [
      {
        "type": "jobEntry",
        "id": "job_1",
        "layout": "grid",
        "gridTemplateColumns": "2fr 1fr",
        "children": [
          {
            "type": "companyInfo",
            "children": [
              { "type": "text", "value": "[JOB TITLE]", "formatting": { "fontSize": 12, "bold": true, "fontFamily": "Inter" } },
              { "type": "text", "value": "[COMPANY NAME]", "formatting": { "fontSize": 11, "color": "#4a5568" } }
            ]
          },
          {
            "type": "dateLocation",
            "alignment": "right",
            "children": [
              { "type": "text", "value": "[START - END DATE]", "formatting": { "fontSize": 11, "color": "#718096", "italic": true } },
              { "type": "text", "value": "[LOCATION]", "formatting": { "fontSize": 11, "color": "#718096" } }
            ]
          }
        ]
      },
      {
        "type": "bulletList",
        "id": "bullets_job_1",
        "bulletStyle": "•",
        "bulletColor": "#3182ce",
        "spacing": 4,
        "children": [
          {
            "type": "bulletPoint",
            "id": "bullet_1_1",
            "children": [
              { "type": "text", "value": "[BULLET TEXT BEFORE METRIC]", "formatting": { "fontSize": 10.5, "fontFamily": "Inter" } },
              { "type": "text", "value": "[METRIC IF ANY e.g. 40%]", "formatting": { "bold": true, "color": "#2c7a7b" } },
              { "type": "text", "value": "[BULLET TEXT AFTER METRIC]", "formatting": { "fontSize": 10.5 } }
            ]
          }
        ]
      }
    ]
  },
  "skills": {
    "type": "section",
    "id": "skills_section_1",
    "title": "TECHNICAL SKILLS",
    "titleFormatting": { "fontFamily": "Montserrat", "fontSize": 14, "bold": true, "borderBottom": "1px solid #cbd5e0", "marginTop": 15, "marginBottom": 8 },
    "children": [
      {
        "type": "skillCategories",
        "layout": "grid",
        "columns": 2,
        "gap": 15,
        "children": [
          {
            "type": "category",
            "title": "Languages",
            "titleFormatting": { "fontSize": 11, "bold": true, "color": "#2d3748" },
            "skills": [
              { "value": "[SKILL]", "formatting": { "fontSize": 10, "backgroundColor": "#edf2f7", "padding": "4px 12px", "borderRadius": 12 } }
            ]
          },
          {
            "type": "category",
            "title": "Frameworks",
            "titleFormatting": { "fontSize": 11, "bold": true, "color": "#2d3748" },
            "skills": [
              { "value": "[SKILL]", "formatting": { "fontSize": 10, "backgroundColor": "#edf2f7", "padding": "4px 12px", "borderRadius": 12 } }
            ]
          }
        ]
      }
    ]
  },
  "education": {
    "type": "section",
    "id": "education_section_1",
    "title": "EDUCATION",
    "titleFormatting": { "fontFamily": "Montserrat", "fontSize": 14, "bold": true, "borderBottom": "1px solid #cbd5e0", "marginTop": 15, "marginBottom": 8 },
    "children": [
      {
        "type": "educationEntry",
        "id": "edu_1",
        "children": [
          { "type": "text", "value": "[DEGREE]", "formatting": { "fontSize": 11, "bold": true } },
          { "type": "text", "value": "[INSTITUTION]", "formatting": { "fontSize": 10.5, "color": "#4a5568" } },
          { "type": "text", "value": "[DATES]", "formatting": { "fontSize": 10.5, "color": "#718096", "alignment": "right" } }
        ]
      }
    ]
  }
}

Extract all content from the PDF now and return the complete populated Atomic JSON.
`;
  }

  // ─── ID NORMALIZER ─────────────────────────────────────────────────────────

  private normalizeIds(resumeJson: Record<string, any>): Record<string, any> {
    // Walks the entire JSON tree and ensures every node id is unique.
    // Gemini sometimes returns duplicate ids despite the prompt instructions.
    // Any duplicate id gets a UUID suffix appended to make it unique.

    const seenIds = new Set<string>();

    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map(walk);

      if (node.id !== undefined) {
        if (seenIds.has(node.id)) {
          node.id = `${node.id}_${uuidv4().slice(0, 8)}`;
        }
        seenIds.add(node.id);
      }

      if (node.children && Array.isArray(node.children)) {
        node.children = node.children.map(walk);
      }

      if (node.skills && Array.isArray(node.skills)) {
        node.skills = node.skills.map(walk);
      }

      return node;
    };

    return walk(resumeJson);
  }
}