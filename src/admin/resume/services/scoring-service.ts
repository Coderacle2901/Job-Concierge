import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ResumeAtsService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(ResumeAtsService.name);

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // ─── CALCULATE BASELINE ATS SCORE ─────────────────────────────────────────

  async calculateBaselineScore(resumeJson: Record<string, any>): Promise<number> {
    // Extracts plain text from the Atomic JSON and sends it to Gemini
    // for ATS scoring. Returns a score between 0 and 100.
    //
    // Called by ResumeService after every save and update operation.
    // The score is stored on BaseResume.atsBaselineScore.
    // Target baseline for a usable base resume is >= 75 per the spec.

    this.logger.log('Calculating ATS baseline score...');

    const plainText = this.extractPlainText(resumeJson);

    if (!plainText || plainText.trim().length === 0) {
      this.logger.warn('Resume has no extractable text — returning score 0');
      return 0;
    }

    const score = await this.scoreWithGemini(plainText);
    this.logger.log(`ATS baseline score calculated: ${score}`);

    return score;
  }

  // ─── GEMINI SCORING ────────────────────────────────────────────────────────

  private async scoreWithGemini(
    plainText: string,
  ): Promise<number> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
You are an expert ATS (Applicant Tracking System) evaluator for the JobConcierge platform.
Analyze the resume content below and return an ATS baseline score from 0 to 100.

SCORING CRITERIA:
- Contact information completeness (name, email, phone, LinkedIn): 10 points
- Professional summary present and relevant: 10 points  
- Work experience with quantifiable metrics (%, $, time saved): 25 points
- Strong action verbs used in bullet points: 15 points
- Skills section with categorized technical skills: 20 points
- Education section present: 10 points
- Overall keyword density and relevance: 10 points

RESUME CONTENT:
${plainText}

Return ONLY a valid JSON object in this exact format, nothing else:
{
  "score": <number between 0 and 100>,
  "breakdown": {
    "contactInfo": <0-10>,
    "summary": <0-10>,
    "experience": <0-25>,
    "actionVerbs": <0-15>,
    "skills": <0-20>,
    "education": <0-10>,
    "keywords": <0-10>
  },
  "missingKeywords": ["keyword1", "keyword2"],
  "suggestions": ["suggestion1", "suggestion2"]
}
`;

    try {
      const result = await model.generateContent(prompt);
      const rawResponse = result.response.text();

      const cleanedResponse = rawResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      // Clamp score between 0 and 100 as a safety measure
      // in case Gemini returns an out-of-range value
      const score = Math.min(100, Math.max(0, parsed.score));
      return Math.round(score);

    } catch (error: any) {
      this.logger.error('ATS scoring failed:', error.message);
      throw new InternalServerErrorException(
        `Failed to calculate ATS score: ${error.message}`,
      );
    }
  }

  // ─── PLAIN TEXT EXTRACTOR ──────────────────────────────────────────────────

  extractPlainText(resumeJson: Record<string, any>): string {
    // Recursively walks the Atomic JSON tree and extracts all text values
    // into a single plain text string for ATS analysis.
    //
    // Made public so ResumeService can use it independently if needed —
    // for example when doing keyword matching without a full Gemini call.

    const lines: string[] = [];

    const walk = (node: any): void => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      // Extract value from text and link nodes
      if (
        (node.type === 'text' || node.type === 'link') &&
        node.value &&
        typeof node.value === 'string' &&
        node.value.trim() !== '•'
        // Skip bullet separator dots — they add noise to the text extraction
      ) {
        lines.push(node.value.trim());
      }

      // Extract section titles
      if (node.title && typeof node.title === 'string') {
        lines.push(node.title.trim());
      }

      // Extract category titles from skills section
      if (node.type === 'category' && node.title) {
        lines.push(node.title);
      }

      // Extract skill values from category nodes
      if (node.skills && Array.isArray(node.skills)) {
        node.skills.forEach((skill: any) => {
          if (skill.value) lines.push(skill.value);
        });
      }

      // Recurse into children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    };

    // Walk all sections except metadata
    const sections = [
      'personalInfo',
      'professionalSummary',
      'workExperience',
      'skills',
      'education',
    ];

    sections.forEach((section) => {
      if (resumeJson[section]) {
        walk(resumeJson[section]);
      }
    });

    return lines.join(' ');
  }
}